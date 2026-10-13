// cspell:ignore presign
import { sha256 } from '@noble/hashes/sha256';
import { Mutex } from 'async-mutex';
import BigNumber from 'bignumber.js';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  BINANCE_DEPOSIT_API_PREFIX,
  BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
  BINANCE_DEPOSIT_CREATE_TIMEOUT_MS,
  BINANCE_DEPOSIT_MAX_DEBUG_EVENTS,
  BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS,
  BINANCE_DEPOSIT_PARAMS_ERROR_CODE,
  BINANCE_DEPOSIT_RETURN_NONCE_REGEX,
  BINANCE_DEPOSIT_RETURN_PARAM_NAME_PLACEHOLDER,
  BINANCE_DEPOSIT_RETURN_PARAM_NAME_REGEX,
  BINANCE_DEPOSIT_RETURN_REASON,
  BINANCE_DEPOSIT_SERVICE_ERROR_CODE,
  BINANCE_DEPOSIT_SESSION_KEY_REGEX,
  EBinanceDepositLocalErrorCode,
} from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import type { IBinanceDepositReturnReason } from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { BinanceDepositScene } from '@onekeyhq/shared/src/logger/scopes/fiatCrypto/scenes/binanceDeposit';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import secureStorageInstance from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';
import {
  buildBinanceDepositSessionKeyStorageKey,
  canRearmBinanceDepositReport,
  compareBinanceDepositDestination,
  generateBinanceDepositSessionKey,
  getBinanceDepositAssetBlockReason,
  getBinanceDepositLocalBindDeadline,
  getBinanceDepositSendAttemptAckWaitMs,
  isBinanceDepositReportFinalErrorCode,
  isBinanceDepositSessionClosed,
  isBinanceDepositSessionInProgress,
  isBinanceDepositTerminalStatus,
  maskBinanceDepositSessionId,
  maskBinanceDepositTxHash,
  resolveBinanceDepositBindStep,
  sanitizeBinanceDepositLogDetail,
  validateBinanceDepositLink,
} from '@onekeyhq/shared/src/utils/binanceDepositUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import {
  EBinanceDepositErrorCode,
  EBinanceDepositSessionStatus,
} from '@onekeyhq/shared/types/exchange';
import type {
  IBinanceDepositAssetNetwork,
  IBinanceDepositAssetSymbol,
  IBinanceDepositAuthorizedDestination,
  IBinanceDepositBindCallResult,
  IBinanceDepositCreateSessionParams,
  IBinanceDepositDebugEvent,
  IBinanceDepositLocalReport,
  IBinanceDepositLocalReportStatus,
  IBinanceDepositLocalSession,
  IBinanceDepositLocalStatus,
  IBinanceDepositReportResult,
  IBinanceDepositReturnParams,
  IBinanceDepositReturnResult,
  IBinanceDepositReturnSource,
  IBinanceDepositServerReportStatus,
  IBinanceDepositSessionSnapshot,
  IBinanceDepositSessionView,
  IBinanceDepositState,
} from '@onekeyhq/shared/types/exchange';

import ServiceBase from './ServiceBase';

import type { IBinanceDepositAddSessionResult } from '../dbs/simple/entity/SimpleDbEntityBinanceDeposit';

// The server issues the id as 32 random bytes in lowercase hex. It is checked
// before it is ever put into a request path.
const SESSION_ID_REGEX = /^[0-9a-f]{64}$/;
// Distinct well-formed nonces kept while another one is being bound. A forged
// return is rejected by the server in one round trip, so the real one only
// has to wait behind it instead of being dropped.
const MAX_QUEUED_RETURN_NONCES = 3;
const MAX_REJECTED_NONCE_DIGESTS = 8;
// Same upper bound as the server DTO for txHash / senderAddress.
const MAX_REPORT_FIELD_LENGTH = 128;
const LOG_NAME_MAX_LENGTH = 20;
const LOG_ERROR_CODE_MAX_LENGTH = 18;
const LOG_IDENTIFIER_REGEX = /^[A-Za-z0-9_]+$/;
// Shorter than a return nonce, so one passed by mistake is never recorded.
const MAIN_DISCARD_REASON_MAX_LENGTH = 32;
const MAIN_DISCARD_REASON_PLACEHOLDER = 'invalid_reason';

const RETURN_SOURCES: readonly IBinanceDepositReturnSource[] = [
  'os_initial',
  'os_event',
  'foreground_fallback',
];

// On a create replay these two say nothing about the session: the switches
// are checked before the server looks up the key, so the first attempt may
// well have created one that still holds the asset's slot.
const CREATE_REPLAY_RETRYABLE_ERROR_CODES: ReadonlySet<number> = new Set([
  EBinanceDepositErrorCode.FeatureDisabled,
  EBinanceDepositErrorCode.DepositDisabled,
]);

// The server never moves a session backwards, so a response carrying a lower
// rank than the stored status is a stale one that arrived late.
const STATUS_RANK: Record<IBinanceDepositLocalStatus, number> = {
  LOCAL_PENDING_CREATE: 0,
  [EBinanceDepositSessionStatus.CREATING]: 1,
  [EBinanceDepositSessionStatus.INIT]: 2,
  [EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND]: 3,
  [EBinanceDepositSessionStatus.AUTHORIZED]: 4,
  [EBinanceDepositSessionStatus.REJECTED]: 5,
  [EBinanceDepositSessionStatus.EXPIRED]: 5,
  [EBinanceDepositSessionStatus.SECURITY_CONFLICT]: 5,
};

// Every message below is a fixed string. Nothing taken from a request, a
// response or a caught error is ever put into an error message.
const LOCAL_ERROR_MESSAGES: Record<EBinanceDepositLocalErrorCode, string> = {
  [EBinanceDepositLocalErrorCode.SessionInProgress]:
    'A Binance deposit session is already in progress. Continue or abandon it first.',
  [EBinanceDepositLocalErrorCode.StorageUnavailable]:
    'Unable to store the Binance deposit session on this device.',
  [EBinanceDepositLocalErrorCode.RequestFailed]:
    'Binance deposit request failed. Please check your network and try again.',
  [EBinanceDepositLocalErrorCode.SessionNotFound]:
    'Binance deposit session not found on this device.',
  [EBinanceDepositLocalErrorCode.InvalidSessionState]:
    'This action is not available for the current Binance deposit session.',
  [EBinanceDepositLocalErrorCode.SessionKeyMissing]:
    'The Binance deposit session key is no longer available. Please start a new deposit.',
  [EBinanceDepositLocalErrorCode.LinkRejected]:
    'The Binance authorization link did not pass verification.',
  [EBinanceDepositLocalErrorCode.LinkUnavailable]:
    'The Binance authorization link is not available. Please refresh or start a new deposit.',
  [EBinanceDepositLocalErrorCode.RevalidateFailed]:
    'Binance deposit address could not be re-verified. Please start a new deposit.',
  [EBinanceDepositLocalErrorCode.ReportPending]:
    'This Binance deposit still has a pending report and cannot be abandoned.',
  [EBinanceDepositLocalErrorCode.InvalidParams]:
    'Invalid Binance deposit parameters.',
  [EBinanceDepositLocalErrorCode.EndpointMismatch]:
    'This Binance deposit session was created on a different server environment. Switch back to that environment to continue.',
  [EBinanceDepositLocalErrorCode.SendAttemptUnresolved]:
    'A previous transfer for this deposit may already have been sent. Check the account history before sending again.',
  [EBinanceDepositLocalErrorCode.SessionKeyUnreadable]:
    'The Binance deposit session key could not be read on this device. Please try again later.',
  [EBinanceDepositLocalErrorCode.SendAttemptAckTooEarly]:
    'The previous transfer may still be signing or broadcasting. Wait, then check the account history before confirming it was not sent.',
};

const REVALIDATE_RETRYABLE_MESSAGE =
  'Binance deposit address could not be re-verified. Please check your network and try again.';

const SERVER_ERROR_MESSAGES: Partial<Record<number, string>> = {
  [BINANCE_DEPOSIT_SERVICE_ERROR_CODE]:
    'Binance deposit service is temporarily unavailable. Please try again.',
  [BINANCE_DEPOSIT_PARAMS_ERROR_CODE]:
    'Binance deposit request was rejected by the server.',
  [EBinanceDepositErrorCode.FeatureDisabled]:
    'Binance Connect is currently disabled.',
  [EBinanceDepositErrorCode.DepositDisabled]:
    'Binance deposit is currently unavailable.',
  [EBinanceDepositErrorCode.CapabilityStale]:
    'Asset list is out of date. Please refresh and try again.',
  [EBinanceDepositErrorCode.SecurityConflict]:
    'Deposit authorization could not be verified. Please start a new deposit.',
  [EBinanceDepositErrorCode.ReportConflict]:
    'This deposit has already been reported with a different transaction.',
  [EBinanceDepositErrorCode.RateLimited]:
    'Too many deposit requests. Please try again later.',
  [EBinanceDepositErrorCode.BindProofInvalid]:
    'Authorization could not be confirmed on this device. Please start a new deposit.',
};

const FALLBACK_SERVER_ERROR_MESSAGE = 'Binance deposit request failed.';

type IDepositRequestFailure = {
  ok: false;
  // Business code of a well-formed response. Absent when no verdict was
  // received, or when the body carried no numeric code.
  code?: number;
  // No business verdict: network error, timeout, non-2xx status or a body
  // that is not a response envelope.
  isNetworkError: boolean;
  errorName?: string;
  httpStatus?: number;
  durationMs: number;
  // Set when the request was refused on this device and never sent.
  localErrorCode?: EBinanceDepositLocalErrorCode;
};

type IDepositRequestResult<T> =
  | { ok: true; data: T; durationMs: number }
  | IDepositRequestFailure;

type ISessionKeyRead =
  | { status: 'ok'; sessionKey: string }
  // Confirmed absent: the session can no longer talk to the server.
  | { status: 'missing' }
  // The read itself failed (locked keychain, platform hiccup), or the
  // platform cannot tell a failed read from an absent item: may heal.
  | { status: 'unreadable' };

type IDestinationIssue = 'asset_mismatch' | 'changed';

type IViewMergeResult = {
  session: IBinanceDepositLocalSession;
  destinationIssue?: IDestinationIssue;
};

type IViewApplyResult = {
  session?: IBinanceDepositLocalSession;
  destinationIssue?: IDestinationIssue;
};

type IQueryOutcome =
  | { kind: 'unknown' }
  // Nothing to query: not created on the server yet, or already closed.
  | { kind: 'skipped'; session: IBinanceDepositLocalSession }
  | {
      kind: 'applied';
      session: IBinanceDepositLocalSession;
      view: IBinanceDepositSessionView;
      destinationIssue?: IDestinationIssue;
    }
  // The session was closed locally: its key is gone or the server does not
  // know it.
  | { kind: 'closed'; session?: IBinanceDepositLocalSession }
  | { kind: 'failed'; failure: IDepositRequestFailure };

type IBindJob = {
  // Raw return nonce. Memory only, wiped as soon as the job ends.
  nonce: string;
  // 1-based count of bind calls made with the current nonce.
  attempt: number;
  firstAttemptAt: number;
  queued: string[];
  requestInFlight: boolean;
  cancelled: boolean;
  // The loop is on hold because the app points at another wallet endpoint;
  // kept so the hold is logged once, not on every tick.
  endpointMismatchLogged?: boolean;
  // Ends the retry wait early and clears its timer.
  cancelWait?: () => void;
};

type IBindLoopNext =
  | { next: 'done' }
  | { next: 'retry'; delayMs: number }
  | { next: 'next_nonce' };

type INonceDigests = {
  bound?: string;
  rejected: string[];
};

type IMemoryLink = {
  link: string;
  linkExpireTime?: number;
};

type IDepositLogStep =
  | 'createStart'
  | 'createResult'
  | 'linkOpen'
  | 'returnReceived'
  | 'returnDiscarded'
  | 'bindAttempt'
  | 'bindResult'
  | 'queryResult'
  | 'presignCheck'
  | 'reportAttempt'
  | 'reportResult'
  | 'localCleanup';

type IDepositLogParams = {
  [TStep in IDepositLogStep]: Parameters<BinanceDepositScene[TStep]>[0];
};

const DEPOSIT_LOGGERS: {
  [TStep in IDepositLogStep]: (params: IDepositLogParams[TStep]) => void;
} = {
  createStart: (params) =>
    defaultLogger.fiatCrypto.binanceDeposit.createStart(params),
  createResult: (params) =>
    defaultLogger.fiatCrypto.binanceDeposit.createResult(params),
  linkOpen: (params) =>
    defaultLogger.fiatCrypto.binanceDeposit.linkOpen(params),
  returnReceived: (params) =>
    defaultLogger.fiatCrypto.binanceDeposit.returnReceived(params),
  returnDiscarded: (params) =>
    defaultLogger.fiatCrypto.binanceDeposit.returnDiscarded(params),
  bindAttempt: (params) =>
    defaultLogger.fiatCrypto.binanceDeposit.bindAttempt(params),
  bindResult: (params) =>
    defaultLogger.fiatCrypto.binanceDeposit.bindResult(params),
  queryResult: (params) =>
    defaultLogger.fiatCrypto.binanceDeposit.queryResult(params),
  presignCheck: (params) =>
    defaultLogger.fiatCrypto.binanceDeposit.presignCheck(params),
  reportAttempt: (params) =>
    defaultLogger.fiatCrypto.binanceDeposit.reportAttempt(params),
  reportResult: (params) =>
    defaultLogger.fiatCrypto.binanceDeposit.reportResult(params),
  localCleanup: (params) =>
    defaultLogger.fiatCrypto.binanceDeposit.localCleanup(params),
};

type IUnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is IUnknownRecord {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function pickOptionalString(value: unknown): string | undefined {
  return isNonEmptyString(value) ? value : undefined;
}

function isSessionStatus(
  value: unknown,
): value is EBinanceDepositSessionStatus {
  return (
    typeof value === 'string' &&
    (Object.values(EBinanceDepositSessionStatus) as string[]).includes(value)
  );
}

function isServerReportStatus(
  value: unknown,
): value is IBinanceDepositServerReportStatus {
  return value === 'PENDING' || value === 'CONFIRMED';
}

function parseDestination(
  data: unknown,
): IBinanceDepositAuthorizedDestination | undefined {
  if (!isRecord(data)) {
    return undefined;
  }
  const { networkId, binanceNetwork, cryptoCurrency, address, authorizedAt } =
    data;
  if (
    !isNonEmptyString(networkId) ||
    !isNonEmptyString(binanceNetwork) ||
    !isNonEmptyString(cryptoCurrency) ||
    !isNonEmptyString(address) ||
    !isTimestamp(authorizedAt)
  ) {
    return undefined;
  }
  const destination: IBinanceDepositAuthorizedDestination = {
    networkId,
    binanceNetwork,
    cryptoCurrency,
    address,
    authorizedAt,
  };
  const contractAddress = pickOptionalString(data.contractAddress);
  if (contractAddress) {
    destination.contractAddress = contractAddress;
  }
  const minAmount = pickOptionalString(data.minAmount);
  if (minAmount) {
    destination.minAmount = minAmount;
  }
  const addressTag = pickOptionalString(data.addressTag);
  if (addressTag) {
    destination.addressTag = addressTag;
  }
  return destination;
}

// The response body is untrusted input at this boundary: only a view with the
// expected shape, and for query / bind the expected session id, is accepted.
function parseSessionView(
  data: unknown,
  expectedSessionId?: string,
): IBinanceDepositSessionView | undefined {
  if (!isRecord(data)) {
    return undefined;
  }
  const { sessionId, status, networkId, cryptoCurrency } = data;
  if (
    typeof sessionId !== 'string' ||
    !SESSION_ID_REGEX.test(sessionId) ||
    (expectedSessionId !== undefined && sessionId !== expectedSessionId) ||
    !isSessionStatus(status) ||
    !isNonEmptyString(networkId) ||
    !isNonEmptyString(cryptoCurrency)
  ) {
    return undefined;
  }
  const view: IBinanceDepositSessionView = {
    sessionId,
    status,
    networkId,
    cryptoCurrency,
  };
  const contractAddress = pickOptionalString(data.contractAddress);
  if (contractAddress) {
    view.contractAddress = contractAddress;
  }
  const reportedTxHash = pickOptionalString(data.reportedTxHash);
  if (reportedTxHash) {
    view.reportedTxHash = reportedTxHash;
  }
  if (isServerReportStatus(data.reportStatus)) {
    view.reportStatus = data.reportStatus;
  }
  const link = pickOptionalString(data.link);
  if (link) {
    view.link = link;
  }
  if (isTimestamp(data.linkExpireTime)) {
    view.linkExpireTime = data.linkExpireTime;
  }
  if (isTimestamp(data.bindDeadline)) {
    view.bindDeadline = data.bindDeadline;
  }
  if (data.authorizedDestination !== undefined) {
    const destination = parseDestination(data.authorizedDestination);
    if (!destination) {
      return undefined;
    }
    view.authorizedDestination = destination;
  }
  return view;
}

function parseCreateView(
  data: unknown,
): IBinanceDepositSessionView | undefined {
  return parseSessionView(data);
}

function parseReportResult(
  data: unknown,
): IBinanceDepositReportResult | undefined {
  return isRecord(data) && data.reportAccepted === true
    ? { reportAccepted: true }
    : undefined;
}

function toLogIdentifier(value: unknown, maxLength: number): string {
  return typeof value === 'string' && LOG_IDENTIFIER_REGEX.test(value)
    ? value.slice(0, maxLength)
    : '';
}

// The only place a caught request error is looked at. An axios error keeps
// its request config, whose `data` is the request body (session key, return
// nonce), so nothing but its name, error code and HTTP status is read and the
// error object itself never leaves this function.
function describeRequestError(
  error: unknown,
): Pick<IDepositRequestFailure, 'errorName' | 'httpStatus'> {
  if (!isRecord(error)) {
    return { errorName: 'UnknownError' };
  }
  const name = toLogIdentifier(error.name, LOG_NAME_MAX_LENGTH) || 'Error';
  const errorCode = toLogIdentifier(error.code, LOG_ERROR_CODE_MAX_LENGTH);
  let httpStatus: number | undefined;
  if (typeof error.httpStatusCode === 'number') {
    httpStatus = error.httpStatusCode;
  } else if (
    isRecord(error.response) &&
    typeof error.response.status === 'number'
  ) {
    httpStatus = error.response.status;
  }
  return {
    errorName: errorCode ? `${name}:${errorCode}` : name,
    httpStatus,
  };
}

function describeOutcome<T>(outcome: IDepositRequestResult<T>) {
  if (outcome.ok) {
    return { ok: true, code: 0, durationMs: outcome.durationMs };
  }
  return {
    ok: false,
    code: outcome.code,
    isNetworkError: outcome.isNetworkError,
    errorName: outcome.errorName,
    httpStatus: outcome.httpStatus,
    durationMs: outcome.durationMs,
  };
}

// A failure that says nothing final about the request: it may be repeated.
function isRetryableFailure(failure: IDepositRequestFailure): boolean {
  return (
    failure.isNetworkError ||
    failure.code === undefined ||
    failure.code === BINANCE_DEPOSIT_SERVICE_ERROR_CODE
  );
}

function buildLocalError(
  code: EBinanceDepositLocalErrorCode,
  options?: { autoToast?: boolean; message?: string },
): OneKeyError {
  return new OneKeyError({
    message: options?.message ?? LOCAL_ERROR_MESSAGES[code],
    code,
    autoToast: options?.autoToast ?? false,
  });
}

// Stands in for a request that was not sent because the session belongs to
// another wallet endpoint. Shaped as "no verdict" so every caller leaves the
// session, its key and its report as they are.
function buildEndpointMismatchFailure(): IDepositRequestFailure {
  return {
    ok: false,
    isNetworkError: true,
    errorName: 'EndpointMismatch',
    durationMs: 0,
    localErrorCode: EBinanceDepositLocalErrorCode.EndpointMismatch,
  };
}

function buildRequestError(failure: IDepositRequestFailure): OneKeyError {
  if (failure.localErrorCode !== undefined) {
    return buildLocalError(failure.localErrorCode);
  }
  if (failure.isNetworkError || failure.code === undefined) {
    return buildLocalError(EBinanceDepositLocalErrorCode.RequestFailed);
  }
  return new OneKeyError({
    message:
      SERVER_ERROR_MESSAGES[failure.code] ?? FALLBACK_SERVER_ERROR_MESSAGE,
    code: failure.code,
    autoToast: false,
  });
}

function getSid(
  session: Pick<IBinanceDepositLocalSession, 'sessionId' | 'localId'>,
): string {
  return maskBinanceDepositSessionId(session.sessionId ?? session.localId);
}

// Kept instead of the nonce itself to recognize a replayed return after the
// nonce was dropped. Memory only.
function digestNonce(nonce: string): string {
  return bufferUtils.bytesToHex(sha256(bufferUtils.toBuffer(nonce, 'utf8')));
}

function isSameContractAddress(a?: string, b?: string): boolean {
  // The server stores the upstream spelling, the request carried the caller's.
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
}

// A released address is only usable for the asset this session was created
// for; the transfer is built from the session's network and token.
function isDestinationForSession(
  destination: IBinanceDepositAuthorizedDestination,
  session: IBinanceDepositLocalSession,
): boolean {
  return (
    destination.networkId === session.networkId &&
    destination.cryptoCurrency === session.cryptoCurrency &&
    isSameContractAddress(destination.contractAddress, session.contractAddress)
  );
}

const HEX_TX_HASH_REGEX = /^(?:0x)?[0-9a-fA-F]{64}$/;

// The server returns the canonical spelling of a reported hash, which for hex
// hashes may differ from the local one in case only.
function isSameTxHash(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }
  return (
    HEX_TX_HASH_REGEX.test(a) &&
    HEX_TX_HASH_REGEX.test(b) &&
    a.toLowerCase() === b.toLowerCase()
  );
}

function failPendingReport(
  report: IBinanceDepositLocalReport | undefined,
  now: number,
): IBinanceDepositLocalReport | undefined {
  return report?.status === 'PENDING'
    ? { ...report, status: 'FAILED', updatedAt: now }
    : report;
}

// An earlier transfer of the session may be on chain: signing was already
// allowed to start and that was not acknowledged since, or a transaction is
// already recorded (the report slot holds a single one, in any state).
function hasUnresolvedSendAttempt(
  session: Pick<IBinanceDepositLocalSession, 'sendAttemptedAt' | 'report'>,
): boolean {
  return session.sendAttemptedAt !== undefined || !!session.report;
}

// A plain decimal, with the exponent a serialized number may carry (`1e-8`).
// BigNumber alone would also read hex, binary and octal literals, and the
// bounds keep the decimal string built from it short.
const DEPOSIT_DUST_STRING_REGEX =
  /^\d{1,30}(?:\.\d{1,30})?(?:e[+-]?\d{1,2})?$/i;

// The deposit dust as a plain decimal string, or undefined when the value is
// not a finite positive number. The contract says a decimal string while the
// upstream has been sending a JSON number, so both are read.
function parseDepositDust(value: unknown): string | undefined {
  if (typeof value === 'string') {
    if (!DEPOSIT_DUST_STRING_REGEX.test(value)) {
      return undefined;
    }
  } else if (typeof value !== 'number') {
    return undefined;
  }
  const dust = new BigNumber(value);
  return dust.isFinite() && dust.isGreaterThan(0) ? dust.toFixed() : undefined;
}

// A session waits for the Binance return only after this device opened its
// link, and only until the server can no longer accept a bind for it. The
// server freezes the destination, and starts the bind window, after the link
// was used, so the link expiry alone does not end the wait.
function isAwaitingReturn(
  session: IBinanceDepositLocalSession,
  now: number,
): boolean {
  if (
    !isBinanceDepositSessionInProgress(session) ||
    !session.sessionId ||
    !session.linkOpenedAt
  ) {
    return false;
  }
  const deadline = getBinanceDepositLocalBindDeadline(session);
  return deadline === undefined || now < deadline;
}

// A session exists only on the wallet endpoint it was created on. Another
// environment answers `session not found`, which would close it for good, so
// nothing is sent for it while the app points elsewhere. A record written
// before the endpoint was stored, or an endpoint that cannot be resolved, is
// not treated as a mismatch.
function isEndpointMismatch(
  session: Pick<IBinanceDepositLocalSession, 'walletEndpoint'>,
  currentEndpoint: string | undefined,
): boolean {
  return (
    !!session.walletEndpoint &&
    currentEndpoint !== undefined &&
    currentEndpoint !== session.walletEndpoint
  );
}

// Folds a server view into the local record. Pure: every write of a view goes
// through here, so the rules hold no matter which call produced the view.
function mergeServerView(
  session: IBinanceDepositLocalSession,
  view: IBinanceDepositSessionView,
  now: number,
): IViewMergeResult {
  if (
    session.localClosedReason ||
    isBinanceDepositTerminalStatus(session.status) ||
    STATUS_RANK[view.status] < STATUS_RANK[session.status]
  ) {
    return { session };
  }

  const next: IBinanceDepositLocalSession = { ...session };
  if (!next.sessionId) {
    next.sessionId = view.sessionId;
  }

  if (view.status === EBinanceDepositSessionStatus.AUTHORIZED) {
    const destination = view.authorizedDestination;
    // AUTHORIZED is only ever stored together with its destination.
    if (!destination) {
      return { session };
    }
    if (!isDestinationForSession(destination, session)) {
      return { session, destinationIssue: 'asset_mismatch' };
    }
    if (session.destination) {
      // Write-once: the destination shown to the user is never replaced, so
      // the pre-sign check keeps comparing against what was displayed.
      if (!compareBinanceDepositDestination(session.destination, destination)) {
        return { session, destinationIssue: 'changed' };
      }
    } else {
      next.destination = destination;
    }
  }
  next.status = view.status;

  if (view.linkExpireTime !== undefined) {
    next.linkExpireTime = view.linkExpireTime;
  }
  if (view.bindDeadline !== undefined) {
    next.bindDeadline = view.bindDeadline;
  }

  if (
    next.report &&
    next.report.status !== 'CONFIRMED' &&
    view.reportStatus === 'CONFIRMED' &&
    view.reportedTxHash &&
    isSameTxHash(next.report.txHash, view.reportedTxHash)
  ) {
    next.report = { ...next.report, status: 'CONFIRMED', updatedAt: now };
  }
  if (isBinanceDepositTerminalStatus(next.status)) {
    // The report route only accepts AUTHORIZED sessions.
    next.report = failPendingReport(next.report, now);
  }
  return { session: next };
}

function normalizeReturnSource(value: unknown): IBinanceDepositReturnSource {
  return (
    RETURN_SOURCES.find((source) => source === value) ?? 'foreground_fallback'
  );
}

// Names only ever reach the log. Left out entirely when there are none.
function normalizeParamNames(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }
  return value.map((name: unknown) =>
    typeof name === 'string' &&
    BINANCE_DEPOSIT_RETURN_PARAM_NAME_REGEX.test(name)
      ? name
      : BINANCE_DEPOSIT_RETURN_PARAM_NAME_PLACEHOLDER,
  );
}

// The reason comes from the UI runtime. Only a short identifier is recorded;
// anything else is replaced, never truncated.
function normalizeMainDiscardReason(value: unknown): string {
  return typeof value === 'string' &&
    value.length <= MAIN_DISCARD_REASON_MAX_LENGTH &&
    LOG_IDENTIFIER_REGEX.test(value)
    ? value
    : MAIN_DISCARD_REASON_PLACEHOLDER;
}

function normalizeReportField(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  return trimmed.length <= MAX_REPORT_FIELD_LENGTH ? trimmed : '';
}

/**
 * Client side of the Binance Connect deposit flow: create a session, hand
 * its link to the UI, bind it with the nonce Binance returns, re-verify the
 * released address before signing and report the broadcast transaction.
 *
 * Where each secret lives:
 * - session key: secureStorage only (`onekey_bcd_sk.<localId>`);
 * - return nonce and Binance link: maps on this instance only, gone on restart;
 * - simpleDb, logs, debug events, error messages and everything returned to
 *   the UI (except the link handed over by prepareOpenLink) carry none of them.
 */
@backgroundClass()
export default class ServiceBinanceDeposit extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private links = new Map<string, IMemoryLink>();

  private bindJobs = new Map<string, IBindJob>();

  private nonceDigests = new Map<string, INonceDigests>();

  private createFlights = new Map<
    string,
    Promise<IBinanceDepositSessionSnapshot>
  >();

  private createAttempts = new Map<string, number>();

  private reportFlights = new Map<string, Promise<void>>();

  private debugEvents: IBinanceDepositDebugEvent[] = [];

  // Serializes "is a session in progress" with the insert of a new one.
  private createMutex = new Mutex();

  // Serializes the lookup of the waiting session with the start of its bind
  // job, so a replayed return cannot start a second one.
  private returnMutex = new Mutex();

  private get db() {
    return this.backgroundApi.simpleDb.binanceDeposit;
  }

  // Writes one step to the local log and to the in-memory debug buffer. Both
  // receive the same sanitized fields.
  private track<TStep extends IDepositLogStep>(
    step: TStep,
    params: IDepositLogParams[TStep],
  ): void {
    DEPOSIT_LOGGERS[step](params);
    this.debugEvents.push({
      ts: Date.now(),
      step,
      detail: sanitizeBinanceDepositLogDetail(params),
    });
    const overflow = this.debugEvents.length - BINANCE_DEPOSIT_MAX_DEBUG_EVENTS;
    if (overflow > 0) {
      this.debugEvents.splice(0, overflow);
    }
  }

  // All deposit requests go through here. A failure is reduced to a plain
  // result on the spot; no caller ever sees the thrown error.
  private async requestDeposit<T>({
    path,
    body,
    timeout,
    parse,
  }: {
    path: string;
    body: Record<string, string>;
    timeout?: number;
    parse: (data: unknown) => T | undefined;
  }): Promise<IDepositRequestResult<T>> {
    const startedAt = Date.now();
    try {
      const client = await this.getClient(EServiceEndpointEnum.Wallet);
      // autoHandleError: false keeps the interceptor from throwing (and
      // toasting) on a business code; the code is read below instead.
      const requestConfig: { autoHandleError: boolean; timeout?: number } = {
        autoHandleError: false,
      };
      if (timeout !== undefined) {
        requestConfig.timeout = timeout;
      }
      const resp = await client.post<unknown>(
        `${BINANCE_DEPOSIT_API_PREFIX}${path}`,
        body,
        requestConfig,
      );
      const durationMs = Date.now() - startedAt;
      const envelope: unknown = resp.data;
      if (!isRecord(envelope)) {
        return {
          ok: false,
          isNetworkError: true,
          errorName: 'MalformedResponse',
          httpStatus: resp.status,
          durationMs,
        };
      }
      const { code } = envelope;
      if (typeof code !== 'number' || !Number.isFinite(code)) {
        // An unhandled server exception is serialized without a code.
        return {
          ok: false,
          isNetworkError: false,
          errorName: 'MissingResponseCode',
          durationMs,
        };
      }
      if (code !== 0) {
        return { ok: false, code, isNetworkError: false, durationMs };
      }
      const data = parse(envelope.data);
      if (data === undefined) {
        return {
          ok: false,
          isNetworkError: false,
          errorName: 'MalformedResponseData',
          durationMs,
        };
      }
      return { ok: true, data, durationMs };
    } catch (error: unknown) {
      return {
        ok: false,
        isNetworkError: true,
        ...describeRequestError(error),
        durationMs: Date.now() - startedAt,
      };
    }
  }

  // ---- session key (secureStorage) ----

  private async storeSessionKey(
    localId: string,
    sessionKey: string,
  ): Promise<boolean> {
    try {
      const storageKey = buildBinanceDepositSessionKeyStorageKey(localId);
      await secureStorageInstance.setSecureItem(storageKey, sessionKey);
      // setSecureItem is silently skipped in Travel Mode. A session created
      // with a key that was not persisted could not replay a timed-out create.
      const stored = await secureStorageInstance.getSecureItem(storageKey);
      return stored === sessionKey;
    } catch {
      // Not logged: a native storage error may quote what it was given.
      return false;
    }
  }

  private async readSessionKey(localId: string): Promise<ISessionKeyRead> {
    try {
      const value = await secureStorageInstance.getSecureItem(
        buildBinanceDepositSessionKeyStorageKey(localId),
      );
      if (
        typeof value === 'string' &&
        BINANCE_DEPOSIT_SESSION_KEY_REGEX.test(value)
      ) {
        return { status: 'ok', sessionKey: value };
      }
      if (
        platformEnv.isNativeAndroid &&
        (value === null || value === undefined)
      ) {
        // Android answers null for an absent item and also while the Keystore
        // is unavailable or decryption fails, keeping the ciphertext so the
        // read can be retried. Taking that for a loss would close the session
        // and delete a key that may still come back.
        return { status: 'unreadable' };
      }
      return { status: 'missing' };
    } catch {
      return { status: 'unreadable' };
    }
  }

  private async removeSessionKey(localId: string): Promise<boolean> {
    try {
      await secureStorageInstance.removeSecureItem(
        buildBinanceDepositSessionKeyStorageKey(localId),
      );
      return true;
    } catch {
      return false;
    }
  }

  // ---- local session bookkeeping ----

  // Resolved on every call from the dev settings, the same way the request
  // client is, so it follows the test endpoint switch right away.
  private async getCurrentWalletEndpoint(): Promise<string | undefined> {
    try {
      const { endpoint } = await this.getClientEndpointInfo(
        EServiceEndpointEnum.Wallet,
      );
      return isNonEmptyString(endpoint) ? endpoint : undefined;
    } catch {
      // A request would fail the same way; there is nothing to compare.
      return undefined;
    }
  }

  private async hasEndpointMismatch(
    session: Pick<IBinanceDepositLocalSession, 'walletEndpoint'>,
  ): Promise<boolean> {
    return isEndpointMismatch(session, await this.getCurrentWalletEndpoint());
  }

  private toSnapshot(
    session: IBinanceDepositLocalSession,
    currentEndpoint: string | undefined,
    now: number = Date.now(),
  ): IBinanceDepositSessionSnapshot {
    const job = this.bindJobs.get(session.localId);
    return {
      ...session,
      awaitingReturn: isAwaitingReturn(session, now),
      hasPendingNonce: !!job,
      bindInFlight: !!job?.requestInFlight,
      sessionIdMasked: maskBinanceDepositSessionId(session.sessionId),
      // A closed session has nothing left to ask the server.
      endpointMismatch:
        !isBinanceDepositSessionClosed(session) &&
        isEndpointMismatch(session, currentEndpoint),
    };
  }

  private async buildSnapshot(
    session: IBinanceDepositLocalSession,
  ): Promise<IBinanceDepositSessionSnapshot> {
    return this.toSnapshot(session, await this.getCurrentWalletEndpoint());
  }

  private async requireSession(
    localId: string,
  ): Promise<IBinanceDepositLocalSession> {
    const session = isNonEmptyString(localId)
      ? await this.db.getSession(localId)
      : undefined;
    if (!session) {
      throw buildLocalError(EBinanceDepositLocalErrorCode.SessionNotFound);
    }
    return session;
  }

  // Drops everything this instance and secureStorage hold for a session that
  // has just been closed or evicted.
  private async releaseSessionSecrets(
    session: IBinanceDepositLocalSession,
    reason: string,
  ): Promise<void> {
    const { localId } = session;
    this.cancelBindJob(localId);
    this.links.delete(localId);
    this.nonceDigests.delete(localId);
    this.createAttempts.delete(localId);
    const secureRemoved = await this.removeSessionKey(localId);
    this.track('localCleanup', {
      sid: getSid(session),
      reason,
      status: session.status,
      secureRemoved,
    });
  }

  private async closeSessionLocally(
    localId: string,
    reason: string,
    patch?: Pick<IBinanceDepositLocalSession, 'lastErrorCode'>,
  ): Promise<IBinanceDepositLocalSession | undefined> {
    const state = { closedNow: false };
    const stored = await this.db.updateSession(localId, (current) => {
      if (isBinanceDepositSessionClosed(current)) {
        return undefined;
      }
      state.closedNow = true;
      return {
        ...current,
        ...patch,
        localClosedReason: reason,
        report: failPendingReport(current.report, Date.now()),
      };
    });
    if (stored && state.closedNow) {
      await this.releaseSessionSecrets(stored, reason);
    }
    return stored;
  }

  // The single write path for a server view. `getPatch` adds bookkeeping
  // fields of the call that produced the view to the same write.
  private async applyServerView(
    localId: string,
    view: IBinanceDepositSessionView,
    getPatch?: (
      current: IBinanceDepositLocalSession,
    ) => Partial<
      Pick<
        IBinanceDepositLocalSession,
        'lastErrorCode' | 'bindAttempts' | 'lastBindCode'
      >
    >,
  ): Promise<IViewApplyResult> {
    const state: { wasClosed: boolean; issue?: IDestinationIssue } = {
      wasClosed: false,
    };
    const stored = await this.db.updateSession(localId, (current) => {
      state.wasClosed = isBinanceDepositSessionClosed(current);
      const merged = mergeServerView(current, view, Date.now());
      state.issue = merged.destinationIssue;
      return { ...merged.session, ...getPatch?.(current) };
    });
    if (!stored) {
      return {};
    }

    const isOpenInit =
      stored.status === EBinanceDepositSessionStatus.INIT &&
      !stored.localClosedReason;
    if (isOpenInit) {
      if (view.status === EBinanceDepositSessionStatus.INIT && view.link) {
        this.links.set(localId, {
          link: view.link,
          linkExpireTime: view.linkExpireTime,
        });
      }
    } else {
      // The link is only meaningful while the session is INIT.
      this.links.delete(localId);
    }

    if (!state.wasClosed && isBinanceDepositSessionClosed(stored)) {
      await this.releaseSessionSecrets(
        stored,
        isBinanceDepositTerminalStatus(stored.status)
          ? 'server_terminal'
          : 'report_confirmed',
      );
    }
    return { session: stored, destinationIssue: state.issue };
  }

  private async queryAndApply(
    localId: string,
    trigger: string,
  ): Promise<IQueryOutcome> {
    const session = await this.db.getSession(localId);
    if (!session) {
      return { kind: 'unknown' };
    }
    const { sessionId } = session;
    if (!sessionId || isBinanceDepositSessionClosed(session)) {
      return { kind: 'skipped', session };
    }
    const sid = getSid(session);

    if (await this.hasEndpointMismatch(session)) {
      const failure = buildEndpointMismatchFailure();
      this.track('queryResult', { sid, trigger, ...describeOutcome(failure) });
      return { kind: 'failed', failure };
    }

    const keyRead = await this.readSessionKey(localId);
    if (keyRead.status === 'missing') {
      return {
        kind: 'closed',
        session: await this.closeSessionLocally(localId, 'key_missing'),
      };
    }
    if (keyRead.status === 'unreadable') {
      const failure: IDepositRequestFailure = {
        ok: false,
        isNetworkError: true,
        errorName: 'SecureStorageUnreadable',
        durationMs: 0,
      };
      this.track('queryResult', { sid, trigger, ...describeOutcome(failure) });
      return { kind: 'failed', failure };
    }

    const outcome = await this.requestDeposit({
      path: `/deposit/sessions/${sessionId}/query`,
      body: { sessionKey: keyRead.sessionKey },
      parse: (data) => parseSessionView(data, sessionId),
    });
    if (!outcome.ok) {
      this.track('queryResult', { sid, trigger, ...describeOutcome(outcome) });
      if (outcome.code === BINANCE_DEPOSIT_PARAMS_ERROR_CODE) {
        // The id and the key were format-checked before the call, so this is
        // `session not found`: the server does not know this id / key pair.
        return {
          kind: 'closed',
          session: await this.closeSessionLocally(
            localId,
            'key_missing_or_unknown_session',
            { lastErrorCode: outcome.code },
          ),
        };
      }
      return { kind: 'failed', failure: outcome };
    }

    const view = outcome.data;
    const applied = await this.applyServerView(localId, view);
    this.track('queryResult', {
      sid,
      trigger,
      ...describeOutcome(outcome),
      status: view.status,
      hasLink: !!view.link,
      hasDestination: !!view.authorizedDestination,
      linkExpireTime: view.linkExpireTime,
      bindDeadline: view.bindDeadline,
      reportStatus: view.reportStatus,
    });
    if (applied.destinationIssue) {
      this.track('presignCheck', {
        sid,
        ok: true,
        status: view.status,
        destinationMatches: false,
        reason: `${trigger}_${applied.destinationIssue}`,
      });
    }
    if (!applied.session) {
      return { kind: 'unknown' };
    }
    return {
      kind: 'applied',
      session: applied.session,
      view,
      destinationIssue: applied.destinationIssue,
    };
  }

  // ---- asset capability ----

  // Undefined when the app has no vault for the network.
  private async getIsSingleTokenNetwork(
    networkId: string,
  ): Promise<boolean | undefined> {
    try {
      const settings = await this.backgroundApi.serviceNetwork.getVaultSettings(
        { networkId },
      );
      return settings.isSingleToken;
    } catch {
      return undefined;
    }
  }

  // ---- create ----

  private launchCreate({
    localId,
    isRetry,
    sessionKey,
  }: {
    localId: string;
    isRetry: boolean;
    sessionKey?: string;
  }): Promise<IBinanceDepositSessionSnapshot> {
    const inFlight = this.createFlights.get(localId);
    if (inFlight) {
      return inFlight;
    }
    const flight = this.runCreate({ localId, isRetry, sessionKey }).finally(
      () => {
        if (this.createFlights.get(localId) === flight) {
          this.createFlights.delete(localId);
        }
      },
    );
    this.createFlights.set(localId, flight);
    return flight;
  }

  private async runCreate({
    localId,
    isRetry,
    sessionKey: freshSessionKey,
  }: {
    localId: string;
    isRetry: boolean;
    sessionKey?: string;
  }): Promise<IBinanceDepositSessionSnapshot> {
    const session = await this.requireSession(localId);
    const sid = getSid(session);

    if (await this.hasEndpointMismatch(session)) {
      const failure = buildEndpointMismatchFailure();
      this.track('createResult', {
        sid,
        attempt: this.createAttempts.get(localId) ?? 0,
        ...describeOutcome(failure),
        status: session.status,
      });
      throw buildRequestError(failure);
    }

    // A replay must present the key the first attempt used.
    let sessionKey = freshSessionKey;
    if (!sessionKey) {
      const keyRead = await this.readSessionKey(localId);
      if (keyRead.status === 'missing') {
        await this.closeSessionLocally(localId, 'key_missing');
        throw buildLocalError(EBinanceDepositLocalErrorCode.SessionKeyMissing);
      }
      if (keyRead.status === 'unreadable') {
        throw buildLocalError(EBinanceDepositLocalErrorCode.StorageUnavailable);
      }
      sessionKey = keyRead.sessionKey;
    }

    const attempt = (this.createAttempts.get(localId) ?? 0) + 1;
    this.createAttempts.set(localId, attempt);
    this.track('createStart', {
      sid,
      attempt,
      networkId: session.networkId,
      cryptoCurrency: session.cryptoCurrency,
      hasContractAddress: !!session.contractAddress,
      isRetry,
    });

    const body: Record<string, string> = {
      sessionKey,
      networkId: session.networkId,
      cryptoCurrency: session.cryptoCurrency,
    };
    if (session.contractAddress) {
      body.contractAddress = session.contractAddress;
    }
    const outcome = await this.requestDeposit({
      path: '/deposit/sessions',
      body,
      timeout: BINANCE_DEPOSIT_CREATE_TIMEOUT_MS,
      parse: parseCreateView,
    });

    if (outcome.ok) {
      const view = outcome.data;
      const applied = await this.applyServerView(localId, view, () => ({
        lastErrorCode: undefined,
      }));
      const stored = applied.session ?? session;
      this.createAttempts.delete(localId);
      this.track('createResult', {
        sid: getSid(stored),
        attempt,
        ...describeOutcome(outcome),
        status: view.status,
        hasLink: !!view.link,
        linkExpireTime: view.linkExpireTime,
      });
      return this.buildSnapshot(stored);
    }

    this.track('createResult', {
      sid,
      attempt,
      ...describeOutcome(outcome),
      status: session.status,
    });
    const isUndecidedReplay =
      isRetry &&
      outcome.code !== undefined &&
      CREATE_REPLAY_RETRYABLE_ERROR_CODES.has(outcome.code);
    if (isRetryableFailure(outcome) || isUndecidedReplay) {
      // Nothing final was learned: the server may or may not hold a session
      // for this key. Keep the record and the key so the create can be
      // replayed with the same key.
      await this.db.updateSession(localId, (current) => ({
        ...current,
        lastErrorCode: outcome.code,
      }));
      throw buildRequestError(outcome);
    }

    if (outcome.code === EBinanceDepositErrorCode.CapabilityStale) {
      try {
        await this.backgroundApi.serviceToken.clearBinanceSupportedAssetsCache();
      } catch {
        // The cache expires on its own; the create error below matters more.
      }
    }
    await this.closeSessionLocally(localId, 'create_rejected', {
      lastErrorCode: outcome.code,
    });
    throw buildRequestError(outcome);
  }

  // ---- bind loop ----

  private rememberNonceDigest(
    localId: string,
    kind: 'bound' | 'rejected',
    nonce: string,
  ): void {
    const digests = this.nonceDigests.get(localId) ?? { rejected: [] };
    const digest = digestNonce(nonce);
    if (kind === 'bound') {
      digests.bound = digest;
    } else if (!digests.rejected.includes(digest)) {
      digests.rejected.push(digest);
      const overflow = digests.rejected.length - MAX_REJECTED_NONCE_DIGESTS;
      if (overflow > 0) {
        digests.rejected.splice(0, overflow);
      }
    }
    this.nonceDigests.set(localId, digests);
  }

  private cancelBindJob(localId: string): void {
    const job = this.bindJobs.get(localId);
    if (!job) {
      return;
    }
    this.endBindJob(localId, job);
  }

  // Wipes the nonces and the pending retry timer of a job. Safe to call more
  // than once.
  private endBindJob(localId: string, job: IBindJob): void {
    job.cancelled = true;
    job.nonce = '';
    job.queued = [];
    job.cancelWait?.();
    if (this.bindJobs.get(localId) === job) {
      this.bindJobs.delete(localId);
    }
  }

  private waitForBindRetry(job: IBindJob, delayMs: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        job.cancelWait = undefined;
        resolve();
      }, delayMs);
      job.cancelWait = () => {
        clearTimeout(timer);
        job.cancelWait = undefined;
        resolve();
      };
    });
  }

  private startBindJob(localId: string, nonce: string): void {
    const job: IBindJob = {
      nonce,
      attempt: 0,
      firstAttemptAt: Date.now(),
      queued: [],
      requestInFlight: false,
      cancelled: false,
    };
    this.bindJobs.set(localId, job);
    void this.runBindJob(localId, job);
  }

  // Runs in the background until the nonce is bound, rejected, or the window
  // has passed. The caller of handleDepositReturn never waits for it.
  private async runBindJob(localId: string, job: IBindJob): Promise<void> {
    try {
      while (!job.cancelled) {
        const step = await this.bindOnce(localId, job);
        if (job.cancelled || step.next === 'done') {
          break;
        }
        if (step.next === 'retry') {
          await this.waitForBindRetry(job, step.delayMs);
        } else {
          const nextNonce = job.queued.shift();
          if (!nextNonce) {
            break;
          }
          job.nonce = nextNonce;
          job.attempt = 0;
          job.firstAttemptAt = Date.now();
        }
      }
    } catch {
      // A local storage failure. The caught value is not inspected or logged.
      this.track('localCleanup', {
        sid: maskBinanceDepositSessionId(localId),
        reason: 'bind_loop_failed',
      });
    } finally {
      this.endBindJob(localId, job);
    }
  }

  private async bindOnce(
    localId: string,
    job: IBindJob,
  ): Promise<IBindLoopNext> {
    const session = await this.db.getSession(localId);
    const sessionId = session?.sessionId;
    if (!session || !sessionId || !isBinanceDepositSessionInProgress(session)) {
      // Closed, or already authorized by another path, while this loop waited.
      return { next: 'done' };
    }
    const sid = getSid(session);

    if (await this.hasEndpointMismatch(session)) {
      // Nothing is sent, counted or stored. The nonce is kept in memory, in
      // case the app is switched back, until the window known locally ends.
      const step = resolveBinanceDepositBindStep({
        result: { kind: 'error', isNetworkError: true },
        now: Date.now(),
        bindDeadline: session.bindDeadline,
        linkExpireTime: session.linkExpireTime,
        attempt: job.attempt + 1,
        firstAttemptAt: job.firstAttemptAt,
      });
      const onHold = step.action === 'retry';
      if (!onHold || !job.endpointMismatchLogged) {
        this.track('bindResult', {
          sid,
          attempt: job.attempt,
          ...describeOutcome(buildEndpointMismatchFailure()),
          action: step.action,
          reason: step.reason,
          delayMs: step.delayMs,
        });
      }
      job.endpointMismatchLogged = onHold;
      return onHold
        ? {
            next: 'retry',
            delayMs: step.delayMs ?? BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
          }
        : { next: 'done' };
    }
    job.endpointMismatchLogged = false;

    const attempt = job.attempt + 1;
    job.attempt = attempt;
    this.track('bindAttempt', {
      sid,
      attempt,
      bindDeadline: session.bindDeadline,
      linkExpireTime: session.linkExpireTime,
    });

    const keyRead = await this.readSessionKey(localId);
    if (keyRead.status === 'missing') {
      await this.closeSessionLocally(localId, 'key_missing');
      return { next: 'done' };
    }
    let outcome: IDepositRequestResult<IBinanceDepositSessionView>;
    if (keyRead.status === 'unreadable') {
      outcome = {
        ok: false,
        isNetworkError: true,
        errorName: 'SecureStorageUnreadable',
        durationMs: 0,
      };
    } else {
      job.requestInFlight = true;
      try {
        outcome = await this.requestDeposit({
          path: `/deposit/sessions/${sessionId}/bind`,
          body: { sessionKey: keyRead.sessionKey, returnNonce: job.nonce },
          parse: (data) => parseSessionView(data, sessionId),
        });
      } finally {
        job.requestInFlight = false;
      }
    }
    if (job.cancelled) {
      // The session was closed while the request was in flight; its response
      // no longer applies.
      return { next: 'done' };
    }

    const result: IBinanceDepositBindCallResult = outcome.ok
      ? { kind: 'view', view: outcome.data }
      : {
          kind: 'error',
          code: outcome.code,
          isNetworkError: outcome.isNetworkError,
        };
    const step = resolveBinanceDepositBindStep({
      result,
      now: Date.now(),
      bindDeadline: session.bindDeadline,
      linkExpireTime: session.linkExpireTime,
      attempt,
      firstAttemptAt: job.firstAttemptAt,
    });

    // `bindAttempts` counts every bind call of the session, across nonces;
    // `attempt` above restarts with each nonce.
    const view = outcome.ok ? outcome.data : undefined;
    let applied: IViewApplyResult = {};
    if (outcome.ok) {
      applied = await this.applyServerView(
        localId,
        outcome.data,
        (current) => ({
          bindAttempts: (current.bindAttempts ?? 0) + 1,
          lastBindCode: 0,
        }),
      );
    } else {
      const lastBindCode = outcome.code;
      await this.db.updateSession(localId, (current) => ({
        ...current,
        bindAttempts: (current.bindAttempts ?? 0) + 1,
        lastBindCode,
      }));
    }
    this.track('bindResult', {
      sid,
      attempt,
      ...describeOutcome(outcome),
      action: step.action,
      reason: step.reason,
      status: view?.status,
      hasDestination: !!view?.authorizedDestination,
      delayMs: step.delayMs,
    });

    switch (step.action) {
      case 'authorized': {
        if (applied.destinationIssue) {
          // The released address is for another asset than this session was
          // created for. It is never stored, shown or sent to.
          this.track('presignCheck', {
            sid,
            ok: true,
            status: view?.status,
            destinationMatches: false,
            reason: `bind_${applied.destinationIssue}`,
          });
          await this.closeSessionLocally(localId, 'destination_mismatch');
        } else if (
          applied.session?.status === EBinanceDepositSessionStatus.AUTHORIZED &&
          applied.session.destination
        ) {
          this.rememberNonceDigest(localId, 'bound', job.nonce);
        }
        // Otherwise the session was closed by another path meanwhile and the
        // view was not applied.
        return { next: 'done' };
      }
      case 'retry':
        return {
          next: 'retry',
          delayMs: step.delayMs ?? BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
        };
      case 'rejected_nonce': {
        // Only this nonce is dropped. The session is left untouched so a
        // forged or replayed return cannot break it; it goes back to waiting
        // for the real one.
        this.rememberNonceDigest(localId, 'rejected', job.nonce);
        await this.db.updateSession(localId, (current) =>
          isBinanceDepositSessionInProgress(current)
            ? { ...current, returnReceivedAt: undefined }
            : undefined,
        );
        // The same code is returned once the bind window has passed; the
        // query tells whether the server expired the session.
        const refreshed = await this.queryAndApply(
          localId,
          'bind_nonce_rejected',
        );
        const stillWaiting =
          refreshed.kind === 'applied'
            ? isAwaitingReturn(refreshed.session, Date.now())
            : refreshed.kind === 'failed';
        return stillWaiting && job.queued.length > 0
          ? { next: 'next_nonce' }
          : { next: 'done' };
      }
      case 'terminal': {
        if (step.reason === 'session_not_found') {
          await this.closeSessionLocally(
            localId,
            'key_missing_or_unknown_session',
            { lastErrorCode: BINANCE_DEPOSIT_PARAMS_ERROR_CODE },
          );
        }
        // A terminal view was already stored and cleaned up by applyServerView.
        return { next: 'done' };
      }
      default: {
        // give_up: the window known locally has passed.
        const deadlineWasKnown = session.bindDeadline !== undefined;
        const refreshed = await this.queryAndApply(localId, 'bind_give_up');
        if (
          !deadlineWasKnown &&
          refreshed.kind === 'applied' &&
          isBinanceDepositSessionInProgress(refreshed.session) &&
          refreshed.session.bindDeadline !== undefined &&
          refreshed.session.bindDeadline > Date.now()
        ) {
          // Only the link expiry was known so far. The server has frozen the
          // destination since, and its bind window is still open.
          return {
            next: 'retry',
            delayMs: BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
          };
        }
        return { next: 'done' };
      }
    }
  }

  private discardReturn(params: {
    sid?: string;
    source: IBinanceDepositReturnSource;
    reason: IBinanceDepositReturnReason;
    otherParamNames?: string[];
  }): IBinanceDepositReturnResult {
    this.track('returnDiscarded', params);
    return { accepted: false, reason: params.reason };
  }

  private async acceptReturn({
    returnNonce,
    source,
    otherParamNames,
  }: {
    returnNonce: string;
    source: IBinanceDepositReturnSource;
    otherParamNames?: string[];
  }): Promise<IBinanceDepositReturnResult> {
    const digest = digestNonce(returnNonce);
    const { sessions } = await this.db.getSessionList();

    const boundSession = sessions.find(
      (item) => this.nonceDigests.get(item.localId)?.bound === digest,
    );
    if (boundSession) {
      this.track('returnReceived', {
        sid: getSid(boundSession),
        source,
        duplicate: true,
        otherParamNames,
      });
      return {
        accepted: true,
        reason: BINANCE_DEPOSIT_RETURN_REASON.AlreadyBound,
      };
    }

    const now = Date.now();
    const session = sessions.find((item) => isAwaitingReturn(item, now));
    if (!session) {
      return this.discardReturn({
        source,
        reason: BINANCE_DEPOSIT_RETURN_REASON.NoWaitingSession,
        otherParamNames,
      });
    }
    const { localId } = session;
    const sid = getSid(session);

    if (await this.hasEndpointMismatch(session)) {
      // Not taken in, and nothing is stored or started for it. Accepting it
      // would settle the return in the UI runtime, which then drops the URL
      // from the OS link cache, while the nonce would only sit in memory
      // here: switching back restarts the app, and the return would be gone.
      // Left in the cache, it is read again after that restart on iOS, which
      // keeps the process. On Android the restart kills the process and the
      // cache with it, so the return is lost there either way.
      return this.discardReturn({
        sid,
        source,
        reason: BINANCE_DEPOSIT_RETURN_REASON.EndpointMismatch,
        otherParamNames,
      });
    }

    const job = this.bindJobs.get(localId);
    if (
      job &&
      (job.nonce === returnNonce || job.queued.includes(returnNonce))
    ) {
      this.track('returnReceived', {
        sid,
        source,
        duplicate: true,
        otherParamNames,
      });
      return {
        accepted: true,
        reason: BINANCE_DEPOSIT_RETURN_REASON.Duplicate,
      };
    }
    if (this.nonceDigests.get(localId)?.rejected.includes(digest)) {
      return this.discardReturn({
        sid,
        source,
        reason: BINANCE_DEPOSIT_RETURN_REASON.NonceAlreadyRejected,
        otherParamNames,
      });
    }
    if (job) {
      if (job.queued.length >= MAX_QUEUED_RETURN_NONCES) {
        return this.discardReturn({
          sid,
          source,
          reason: BINANCE_DEPOSIT_RETURN_REASON.QueueFull,
          otherParamNames,
        });
      }
      job.queued.push(returnNonce);
      this.track('returnReceived', {
        sid,
        source,
        duplicate: false,
        otherParamNames,
      });
      return { accepted: true, reason: BINANCE_DEPOSIT_RETURN_REASON.Queued };
    }

    await this.db.updateSession(localId, (current) => ({
      ...current,
      returnReceivedAt: now,
    }));
    this.track('returnReceived', {
      sid,
      source,
      duplicate: false,
      otherParamNames,
    });
    this.startBindJob(localId, returnNonce);
    return { accepted: true };
  }

  // ---- report ----

  private async updateReport(
    localId: string,
    patch: Partial<
      Pick<IBinanceDepositLocalReport, 'status' | 'attempts' | 'lastErrorCode'>
    >,
  ): Promise<IBinanceDepositLocalSession | undefined> {
    return this.db.updateSession(localId, (current) => {
      const { report } = current;
      if (!report) {
        return undefined;
      }
      // A report confirmed by a concurrent query is never downgraded.
      const status: IBinanceDepositLocalReportStatus =
        report.status === 'CONFIRMED'
          ? 'CONFIRMED'
          : (patch.status ?? report.status);
      return {
        ...current,
        report: { ...report, ...patch, status, updatedAt: Date.now() },
      };
    });
  }

  private sendReport(localId: string): Promise<void> {
    const inFlight = this.reportFlights.get(localId);
    if (inFlight) {
      return inFlight;
    }
    const flight = this.runReport(localId).finally(() => {
      if (this.reportFlights.get(localId) === flight) {
        this.reportFlights.delete(localId);
      }
    });
    this.reportFlights.set(localId, flight);
    return flight;
  }

  private async runReport(localId: string): Promise<void> {
    const session = await this.db.getSession(localId);
    const report = session?.report;
    if (!session || report?.status !== 'PENDING') {
      return;
    }
    const sid = getSid(session);
    const { sessionId } = session;

    if (await this.hasEndpointMismatch(session)) {
      // Left PENDING and uncounted: the report can only be delivered to the
      // environment the session lives on.
      this.track('reportResult', {
        sid,
        attempt: report.attempts,
        ...describeOutcome(buildEndpointMismatchFailure()),
        reportStatus: 'PENDING',
      });
      return;
    }

    if (
      !sessionId ||
      session.status !== EBinanceDepositSessionStatus.AUTHORIZED ||
      isBinanceDepositSessionClosed(session)
    ) {
      await this.updateReport(localId, { status: 'FAILED' });
      this.track('reportResult', {
        sid,
        attempt: report.attempts,
        ok: false,
        errorName: 'SessionNotAuthorized',
        reportStatus: 'FAILED',
      });
      return;
    }
    if (report.attempts >= BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS) {
      await this.updateReport(localId, { status: 'FAILED' });
      this.track('reportResult', {
        sid,
        attempt: report.attempts,
        ok: false,
        errorName: 'AttemptsExhausted',
        reportStatus: 'FAILED',
      });
      return;
    }

    const keyRead = await this.readSessionKey(localId);
    if (keyRead.status === 'missing') {
      // Closing the session also fails its pending report.
      await this.closeSessionLocally(localId, 'key_missing');
      return;
    }
    if (keyRead.status === 'unreadable') {
      // Counted like a delivery that failed. A key that never becomes
      // readable would otherwise keep the report PENDING for good, and a
      // session with a PENDING report can neither be abandoned nor replaced.
      // Once the attempts are used up the report is FAILED while the session
      // and the key are kept: the session can be abandoned, and the report
      // re-armed by hand when the key is readable again.
      const unreadableAttempt = report.attempts + 1;
      const unreadableStatus: IBinanceDepositLocalReportStatus =
        unreadableAttempt >= BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS
          ? 'FAILED'
          : 'PENDING';
      const unsent = await this.updateReport(localId, {
        status: unreadableStatus,
        attempts: unreadableAttempt,
        lastErrorCode: EBinanceDepositLocalErrorCode.SessionKeyUnreadable,
      });
      this.track('reportResult', {
        sid,
        attempt: unreadableAttempt,
        ok: false,
        errorName: 'SecureStorageUnreadable',
        reportStatus: unsent?.report?.status ?? unreadableStatus,
      });
      return;
    }

    const attempt = report.attempts + 1;
    await this.updateReport(localId, { attempts: attempt });
    this.track('reportAttempt', {
      sid,
      attempt,
      txHashPrefix: maskBinanceDepositTxHash(report.txHash),
    });
    const outcome = await this.requestDeposit({
      path: `/deposit/sessions/${sessionId}/report`,
      body: {
        sessionKey: keyRead.sessionKey,
        txHash: report.txHash,
        senderAddress: report.senderAddress,
      },
      parse: parseReportResult,
    });

    let reportStatus: IBinanceDepositLocalReportStatus = 'PENDING';
    let lastErrorCode: number | undefined;
    if (outcome.ok) {
      reportStatus = 'CONFIRMED';
    } else {
      lastErrorCode = outcome.code;
      if (
        isBinanceDepositReportFinalErrorCode(outcome.code) ||
        attempt >= BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS
      ) {
        reportStatus = 'FAILED';
      }
    }
    const stored = await this.updateReport(localId, {
      status: reportStatus,
      lastErrorCode,
    });
    this.track('reportResult', {
      sid,
      attempt,
      ...describeOutcome(outcome),
      reportStatus: stored?.report?.status ?? reportStatus,
    });
    if (reportStatus === 'CONFIRMED' && stored) {
      // Nothing is left to do with the server for this session.
      await this.releaseSessionSecrets(stored, 'report_confirmed');
    }
  }

  // ---- public API ----

  // Read-only view of the local state for the self-test page to poll.
  // `events` is in chronological order (oldest first).
  @backgroundMethod()
  async getState(): Promise<IBinanceDepositState> {
    const { sessions, activeLocalId } = await this.db.getSessionList();
    const now = Date.now();
    const currentEndpoint = await this.getCurrentWalletEndpoint();
    const snapshots = sessions.map((session) =>
      this.toSnapshot(session, currentEndpoint, now),
    );
    return {
      active: snapshots.find((item) => item.localId === activeLocalId),
      recent: snapshots
        .filter((item) => item.localId !== activeLocalId)
        .toSorted((a, b) => b.createdAt - a.createdAt),
      events: [...this.debugEvents],
    };
  }

  @backgroundMethod()
  async createSession(
    params: IBinanceDepositCreateSessionParams,
  ): Promise<IBinanceDepositSessionSnapshot> {
    const input: Partial<IBinanceDepositCreateSessionParams> = params ?? {};
    const { networkId, cryptoCurrency, accountId, senderAddress } = input;
    const contractAddress = pickOptionalString(input.contractAddress);
    if (
      !isNonEmptyString(networkId) ||
      !isNonEmptyString(cryptoCurrency) ||
      !isNonEmptyString(accountId) ||
      !isNonEmptyString(senderAddress)
    ) {
      throw buildLocalError(EBinanceDepositLocalErrorCode.InvalidParams);
    }
    // The rules getDepositAssets applies to the list, for a caller that did
    // not pick the asset from it.
    const isSingleToken = await this.getIsSingleTokenNetwork(networkId);
    if (
      isSingleToken === undefined ||
      getBinanceDepositAssetBlockReason({
        networkId,
        contractAddress,
        isSingleToken,
      })
    ) {
      throw buildLocalError(EBinanceDepositLocalErrorCode.InvalidParams);
    }

    const { localId, sessionKey } = await this.createMutex.runExclusive(
      async () => {
        const { sessions } = await this.db.getSessionList();
        if (sessions.some((item) => isBinanceDepositSessionInProgress(item))) {
          throw buildLocalError(
            EBinanceDepositLocalErrorCode.SessionInProgress,
          );
        }

        const newLocalId = generateUUID();
        let newSessionKey: string;
        try {
          newSessionKey = generateBinanceDepositSessionKey();
        } catch {
          throw buildLocalError(
            EBinanceDepositLocalErrorCode.StorageUnavailable,
          );
        }
        // The key is persisted, and the record written, before the server
        // ever sees the key: a create that times out can then be replayed.
        if (!(await this.storeSessionKey(newLocalId, newSessionKey))) {
          await this.removeSessionKey(newLocalId);
          throw buildLocalError(
            EBinanceDepositLocalErrorCode.StorageUnavailable,
          );
        }

        const now = Date.now();
        const session: IBinanceDepositLocalSession = {
          localId: newLocalId,
          accountId,
          senderAddress,
          networkId,
          cryptoCurrency,
          status: 'LOCAL_PENDING_CREATE',
          createdAt: now,
          updatedAt: now,
        };
        if (contractAddress) {
          session.contractAddress = contractAddress;
        }
        const walletId = pickOptionalString(input.walletId);
        if (walletId) {
          session.walletId = walletId;
        }
        const indexedAccountId = pickOptionalString(input.indexedAccountId);
        if (indexedAccountId) {
          session.indexedAccountId = indexedAccountId;
        }
        const walletEndpoint = await this.getCurrentWalletEndpoint();
        if (walletEndpoint) {
          session.walletEndpoint = walletEndpoint;
        }

        let added: IBinanceDepositAddSessionResult | undefined;
        try {
          added = await this.db.addSession(session);
        } catch {
          added = undefined;
        }
        if (!added?.added) {
          // Not inserted: the key written above belongs to no record.
          await this.removeSessionKey(newLocalId);
          throw buildLocalError(
            added?.inProgressLocalId
              ? EBinanceDepositLocalErrorCode.SessionInProgress
              : EBinanceDepositLocalErrorCode.StorageUnavailable,
          );
        }
        for (const evicted of added.evicted) {
          await this.releaseSessionSecrets(evicted, 'evicted');
        }
        return { localId: newLocalId, sessionKey: newSessionKey };
      },
    );

    return this.launchCreate({ localId, isRetry: false, sessionKey });
  }

  // Replays the create call with the key of the first attempt.
  @backgroundMethod()
  async retryCreate(localId: string): Promise<IBinanceDepositSessionSnapshot> {
    const session = await this.requireSession(localId);
    const canReplay =
      isBinanceDepositSessionInProgress(session) &&
      (session.status === 'LOCAL_PENDING_CREATE' ||
        session.status === EBinanceDepositSessionStatus.CREATING);
    if (!canReplay) {
      throw buildLocalError(EBinanceDepositLocalErrorCode.InvalidSessionState);
    }
    return this.launchCreate({ localId, isRetry: true });
  }

  // Validates the Binance link and hands it to the UI runtime, which opens
  // it. From here on the session accepts a return.
  @backgroundMethod()
  async prepareOpenLink(localId: string): Promise<{ link: string }> {
    const session = await this.requireSession(localId);
    if (!isBinanceDepositSessionInProgress(session) || !session.sessionId) {
      throw buildLocalError(EBinanceDepositLocalErrorCode.InvalidSessionState);
    }
    const sid = getSid(session);

    if (await this.hasEndpointMismatch(session)) {
      // Even with the link at hand: its return could not be bound from here.
      this.track('linkOpen', {
        sid,
        stage: 'prepare',
        ok: false,
        reason: 'endpoint_mismatch',
      });
      throw buildLocalError(EBinanceDepositLocalErrorCode.EndpointMismatch);
    }

    let memoryLink = this.links.get(localId);
    let linkSource: 'memory' | 'query' = 'memory';
    if (!memoryLink) {
      linkSource = 'query';
      const refreshed = await this.queryAndApply(localId, 'open_link');
      if (refreshed.kind === 'failed') {
        this.track('linkOpen', {
          sid,
          stage: 'prepare',
          ok: false,
          linkSource,
          reason: 'query_failed',
        });
        throw buildRequestError(refreshed.failure);
      }
      memoryLink = this.links.get(localId);
    }
    if (!memoryLink) {
      this.track('linkOpen', {
        sid,
        stage: 'prepare',
        ok: false,
        linkSource,
        reason: 'no_link',
      });
      throw buildLocalError(EBinanceDepositLocalErrorCode.LinkUnavailable);
    }

    const { link, linkExpireTime } = memoryLink;
    const check = validateBinanceDepositLink(link, linkExpireTime, Date.now());
    if (!check.ok) {
      this.track('linkOpen', {
        sid,
        stage: 'prepare',
        ok: false,
        linkSource,
        rejectReason: check.reason,
        linkExpireTime,
      });
      throw buildLocalError(EBinanceDepositLocalErrorCode.LinkRejected);
    }

    const stored = await this.db.updateSession(localId, (current) =>
      isBinanceDepositSessionInProgress(current)
        ? { ...current, linkOpenedAt: Date.now() }
        : undefined,
    );
    if (!stored?.linkOpenedAt || !isBinanceDepositSessionInProgress(stored)) {
      throw buildLocalError(EBinanceDepositLocalErrorCode.InvalidSessionState);
    }
    this.track('linkOpen', {
      sid,
      stage: 'prepare',
      ok: true,
      linkSource,
      linkExpireTime,
    });
    return { link };
  }

  @backgroundMethod()
  async refreshSession(
    localId: string,
  ): Promise<IBinanceDepositSessionSnapshot> {
    const session = await this.requireSession(localId);
    if (isBinanceDepositSessionClosed(session)) {
      return this.buildSnapshot(session);
    }
    if (!session.sessionId) {
      // Not confirmed by the server yet: only retryCreate can move it on.
      throw buildLocalError(EBinanceDepositLocalErrorCode.InvalidSessionState);
    }
    const refreshed = await this.queryAndApply(localId, 'refresh');
    if (refreshed.kind === 'failed') {
      throw buildRequestError(refreshed.failure);
    }
    return this.buildSnapshot(await this.requireSession(localId));
  }

  // Accepts the nonce Binance returned through the deep link. Resolves as
  // soon as the bind job is started; the job itself runs in the background.
  @backgroundMethod()
  async handleDepositReturn(
    params: IBinanceDepositReturnParams,
  ): Promise<IBinanceDepositReturnResult> {
    const input: Partial<IBinanceDepositReturnParams> = params ?? {};
    const source = normalizeReturnSource(input.source);
    const otherParamNames = normalizeParamNames(input.otherParamNames);
    const { returnNonce } = input;
    if (
      typeof returnNonce !== 'string' ||
      !BINANCE_DEPOSIT_RETURN_NONCE_REGEX.test(returnNonce)
    ) {
      return this.discardReturn({
        source,
        reason: BINANCE_DEPOSIT_RETURN_REASON.MalformedNonce,
        otherParamNames,
      });
    }
    try {
      return await this.returnMutex.runExclusive(() =>
        this.acceptReturn({ returnNonce, source, otherParamNames }),
      );
    } catch {
      // A local storage failure. Nothing was bound.
      return this.discardReturn({
        source,
        reason: BINANCE_DEPOSIT_RETURN_REASON.LocalError,
        otherParamNames,
      });
    }
  }

  // Must pass right before signing: the session is still AUTHORIZED and the
  // server still reports the destination the user was shown.
  //
  // `markSendAttempt` is for the check that gates the signature itself: once
  // it passes, `sendAttemptedAt` is on disk before signing can start, so a
  // transfer whose result never reaches the app still leaves a trace.
  //
  // Neither kind of call passes while that trace, or a report, is on the
  // session: only acknowledgeSendAttempt makes a marked session pass again.
  @backgroundMethod()
  async revalidateBeforeSign(
    localId: string,
    options?: { markSendAttempt?: boolean },
  ): Promise<void> {
    const markSendAttempt = options?.markSendAttempt === true;
    const failed = buildLocalError(
      EBinanceDepositLocalErrorCode.RevalidateFailed,
      { autoToast: true },
    );
    const session = isNonEmptyString(localId)
      ? await this.db.getSession(localId)
      : undefined;
    const sessionId = session?.sessionId;
    if (
      !session ||
      !sessionId ||
      !session.destination ||
      session.status !== EBinanceDepositSessionStatus.AUTHORIZED ||
      isBinanceDepositSessionClosed(session)
    ) {
      this.track('presignCheck', {
        sid: session ? getSid(session) : '',
        ok: false,
        status: session?.status,
        reason: 'not_authorized_locally',
      });
      throw failed;
    }
    const sid = getSid(session);
    const unresolved = buildLocalError(
      EBinanceDepositLocalErrorCode.SendAttemptUnresolved,
      { autoToast: true },
    );
    // The hard gate against a second transfer. The UI holds the same rule,
    // but on a polled snapshot that can be a moment behind; this one reads
    // the record itself, for both kinds of call, and asks the server nothing.
    if (hasUnresolvedSendAttempt(session)) {
      this.track('presignCheck', {
        sid,
        ok: false,
        status: session.status,
        reason: 'send_attempt_unresolved',
        beforeSend: markSendAttempt ? true : undefined,
      });
      throw unresolved;
    }
    const retryable = buildLocalError(
      EBinanceDepositLocalErrorCode.RequestFailed,
      { autoToast: true, message: REVALIDATE_RETRYABLE_MESSAGE },
    );

    if (await this.hasEndpointMismatch(session)) {
      this.track('presignCheck', {
        sid,
        ok: false,
        reason: 'endpoint_mismatch',
      });
      throw buildLocalError(EBinanceDepositLocalErrorCode.EndpointMismatch, {
        autoToast: true,
      });
    }

    const keyRead = await this.readSessionKey(localId);
    if (keyRead.status === 'missing') {
      await this.closeSessionLocally(localId, 'key_missing');
      this.track('presignCheck', { sid, ok: false, reason: 'key_missing' });
      throw failed;
    }
    if (keyRead.status === 'unreadable') {
      this.track('presignCheck', { sid, ok: false, reason: 'key_unreadable' });
      throw retryable;
    }

    const outcome = await this.requestDeposit({
      path: `/deposit/sessions/${sessionId}/query`,
      body: { sessionKey: keyRead.sessionKey },
      parse: (data) => parseSessionView(data, sessionId),
    });
    if (!outcome.ok) {
      this.track('presignCheck', {
        sid,
        ...describeOutcome(outcome),
        reason: 'query_failed',
      });
      if (outcome.code === BINANCE_DEPOSIT_PARAMS_ERROR_CODE) {
        await this.closeSessionLocally(
          localId,
          'key_missing_or_unknown_session',
          { lastErrorCode: outcome.code },
        );
      }
      throw isRetryableFailure(outcome) ? retryable : failed;
    }

    const view = outcome.data;
    const destinationMatches =
      view.status === EBinanceDepositSessionStatus.AUTHORIZED &&
      compareBinanceDepositDestination(
        session.destination,
        view.authorizedDestination,
      );
    // Stores a terminal status the server may have moved to; a differing
    // destination is never written over the displayed one.
    const applied = await this.applyServerView(localId, view);
    this.track('presignCheck', {
      sid,
      ...describeOutcome(outcome),
      status: view.status,
      destinationMatches,
      beforeSend: markSendAttempt ? true : undefined,
    });
    if (
      !destinationMatches ||
      applied.destinationIssue ||
      applied.session?.status !== EBinanceDepositSessionStatus.AUTHORIZED ||
      isBinanceDepositSessionClosed(applied.session)
    ) {
      throw failed;
    }
    // Test-and-set under the entity lock. Of two checks that both got past
    // the gate above while neither had written yet, only the first one to
    // arrive here passes, so only one signature can start.
    //
    // The view was stored by a write of its own. Another call can take the
    // lock between the two (an abandon, a query that read a terminal status),
    // so that the session is still open is checked again on the record this
    // write is about to change.
    const state: { refusal?: 'closed' | 'unresolved' } = {};
    const stored = await this.db.updateSession(localId, (current) => {
      if (
        current.status !== EBinanceDepositSessionStatus.AUTHORIZED ||
        isBinanceDepositSessionClosed(current)
      ) {
        state.refusal = 'closed';
        return undefined;
      }
      if (hasUnresolvedSendAttempt(current)) {
        state.refusal = 'unresolved';
        return undefined;
      }
      const checkedAt = Date.now();
      const next: IBinanceDepositLocalSession = {
        ...current,
        presignCheckedAt: checkedAt,
      };
      if (markSendAttempt) {
        next.sendAttemptedAt = checkedAt;
      }
      return next;
    });
    if (state.refusal === 'unresolved') {
      this.track('presignCheck', {
        sid,
        ok: false,
        status: view.status,
        reason: 'send_attempt_unresolved',
        beforeSend: markSendAttempt ? true : undefined,
      });
      throw unresolved;
    }
    // The updater does not run for a record that is gone, so only the stored
    // record tells that the check, and the marker with it, was written.
    const isRecorded =
      !!stored && (!markSendAttempt || stored.sendAttemptedAt !== undefined);
    if (state.refusal === 'closed' || !isRecorded) {
      this.track('presignCheck', {
        sid,
        ok: false,
        status: stored?.status,
        reason:
          state.refusal === 'closed' ? 'session_closed' : 'check_not_recorded',
        beforeSend: markSendAttempt ? true : undefined,
      });
      throw failed;
    }
  }

  // Lifts the hold `sendAttemptedAt` puts on sending again. Only to be called
  // once the user has confirmed that the earlier transfer was not sent.
  //
  // Refused for a while after the mark was written: signing and broadcasting
  // of that transfer may still be running then, with nothing in the account
  // history yet for the user to find.
  @backgroundMethod()
  async acknowledgeSendAttempt(
    localId: string,
  ): Promise<IBinanceDepositSessionSnapshot> {
    const session = await this.requireSession(localId);
    const state = { cleared: false, tooEarly: false };
    const stored = await this.db.updateSession(localId, (current) => {
      if (current.sendAttemptedAt === undefined) {
        return undefined;
      }
      // Read under the entity lock, against the very mark being cleared.
      if (
        getBinanceDepositSendAttemptAckWaitMs(
          current.sendAttemptedAt,
          Date.now(),
        ) > 0
      ) {
        state.tooEarly = true;
        return undefined;
      }
      state.cleared = true;
      return { ...current, sendAttemptedAt: undefined };
    });
    if (state.tooEarly) {
      this.track('presignCheck', {
        sid: getSid(session),
        ok: false,
        reason: 'send_attempt_ack_too_early',
      });
      throw buildLocalError(
        EBinanceDepositLocalErrorCode.SendAttemptAckTooEarly,
      );
    }
    if (state.cleared) {
      this.track('presignCheck', {
        sid: getSid(session),
        ok: true,
        reason: 'send_attempt_acknowledged',
      });
    }
    return this.buildSnapshot(stored ?? session);
  }

  // Best effort: the outcome is in the returned snapshot (`report.status`),
  // never in a thrown error. The only rejection is for an unknown localId,
  // for which there is no snapshot to return.
  @backgroundMethod()
  async submitReport(params: {
    localId: string;
    txHash: string;
    senderAddress: string;
  }): Promise<IBinanceDepositSessionSnapshot> {
    const input: Partial<typeof params> = params ?? {};
    const localId = input.localId ?? '';
    const session = await this.requireSession(localId);
    const sid = getSid(session);
    const txHash = normalizeReportField(input.txHash);
    const senderAddress = normalizeReportField(input.senderAddress);

    try {
      if (!txHash || !senderAddress) {
        this.track('reportResult', {
          sid,
          attempt: session.report?.attempts ?? 0,
          ok: false,
          errorName: 'InvalidReportParams',
          reportStatus: session.report?.status ?? 'FAILED',
        });
      } else {
        const state: {
          decision: 'send' | 'final' | 'conflict' | 'not_authorized';
        } = { decision: 'final' };
        // The report is on disk as PENDING before the request is sent, so a
        // broadcast transaction is not forgotten if the app dies in between.
        const stored = await this.db.updateSession(localId, (current) => {
          const { report } = current;
          if (report) {
            if (!isSameTxHash(report.txHash, txHash)) {
              // The server keeps a single hash per session; a second one
              // could never be accepted and must not hide the first.
              state.decision = 'conflict';
            } else {
              state.decision = report.status === 'PENDING' ? 'send' : 'final';
            }
            return undefined;
          }
          const canReport =
            !!current.sessionId &&
            current.status === EBinanceDepositSessionStatus.AUTHORIZED &&
            !isBinanceDepositSessionClosed(current);
          state.decision = canReport ? 'send' : 'not_authorized';
          return {
            ...current,
            report: {
              txHash,
              senderAddress,
              status: canReport ? 'PENDING' : 'FAILED',
              attempts: 0,
              updatedAt: Date.now(),
            },
          };
        });
        if (state.decision === 'send') {
          await this.sendReport(localId);
        } else if (state.decision !== 'final') {
          this.track('reportResult', {
            sid,
            attempt: stored?.report?.attempts ?? 0,
            ok: false,
            errorName:
              state.decision === 'conflict'
                ? 'TxHashConflict'
                : 'SessionNotAuthorized',
            reportStatus: stored?.report?.status ?? 'FAILED',
          });
        }
      }
    } catch {
      // Best effort: the caller is a transaction success callback and must
      // not see a failure. The caught value is not inspected or logged.
    }

    let latest: IBinanceDepositLocalSession | undefined;
    try {
      latest = await this.db.getSession(localId);
    } catch {
      latest = undefined;
    }
    return this.buildSnapshot(latest ?? session);
  }

  // Makes the report of a session sendable again, when it can be. Resolves to
  // whether there is a PENDING report to send.
  private async rearmReport(
    session: IBinanceDepositLocalSession,
  ): Promise<boolean> {
    const state: { pending: boolean; rearmedFrom?: number } = {
      pending: false,
    };
    if (
      session.report?.status === 'FAILED' &&
      canRearmBinanceDepositReport(session)
    ) {
      // Re-armed without a usable key the report would be PENDING again with
      // nothing able to deliver it, and a session with a PENDING report
      // cannot be abandoned. So the key is read first, and the report is left
      // as it is unless the key is there.
      const keyRead = await this.readSessionKey(session.localId);
      if (keyRead.status !== 'ok') {
        this.track('reportResult', {
          sid: getSid(session),
          attempt: session.report.attempts,
          ok: false,
          errorName:
            keyRead.status === 'missing'
              ? 'SessionKeyMissing'
              : 'SecureStorageUnreadable',
          reportStatus: 'FAILED',
        });
        return false;
      }
    }
    await this.db.updateSession(session.localId, (current) => {
      const { report } = current;
      if (report?.status === 'PENDING') {
        state.pending = true;
        return undefined;
      }
      if (!report || !canRearmBinanceDepositReport(current)) {
        return undefined;
      }
      state.pending = true;
      state.rearmedFrom = report.attempts;
      return {
        ...current,
        report: {
          ...report,
          status: 'PENDING',
          attempts: 0,
          updatedAt: Date.now(),
        },
      };
    });
    if (state.rearmedFrom !== undefined) {
      this.track('reportResult', {
        sid: getSid(session),
        attempt: state.rearmedFrom,
        ok: false,
        errorName: 'RearmedManually',
        reportStatus: 'PENDING',
      });
    }
    return state.pending;
  }

  // Manual retry for one session. Sends a PENDING report once more, and
  // re-arms a FAILED one that only ran out of automatic attempts. A report
  // the server refused for good, one of a session that can no longer report,
  // or one whose session key cannot be read right now, is left as it is. Like
  // submitReport, the outcome is in the returned snapshot and the only
  // rejection is for an unknown localId.
  @backgroundMethod()
  async retryReport(localId: string): Promise<IBinanceDepositSessionSnapshot> {
    const session = await this.requireSession(localId);
    try {
      // The endpoint comes first: nothing is re-armed where it cannot be sent.
      if (
        !(await this.hasEndpointMismatch(session)) &&
        (await this.rearmReport(session))
      ) {
        await this.sendReport(localId);
      }
    } catch {
      // Best effort, as in submitReport: the snapshot below tells the result.
    }

    let latest: IBinanceDepositLocalSession | undefined;
    try {
      latest = await this.db.getSession(localId);
    } catch {
      latest = undefined;
    }
    return this.buildSnapshot(latest ?? session);
  }

  // Re-sends every report that is still PENDING. Never throws.
  @backgroundMethod()
  async retryPendingReports(): Promise<void> {
    try {
      const { sessions } = await this.db.getSessionList();
      for (const session of sessions) {
        if (session.report?.status === 'PENDING') {
          await this.sendReport(session.localId);
        }
      }
    } catch {
      // Best effort; the next trigger tries again.
    }
  }

  // Local only: the server has no cancel call, an INIT session there simply
  // expires.
  @backgroundMethod()
  async abandonSession(localId: string): Promise<void> {
    await this.requireSession(localId);
    const state = { blocked: false, closedNow: false };
    const stored = await this.db.updateSession(localId, (current) => {
      if (current.report?.status === 'PENDING') {
        // The transaction may be on chain already; the report still has to
        // be delivered with this session's key.
        state.blocked = true;
        return undefined;
      }
      if (isBinanceDepositSessionClosed(current)) {
        return undefined;
      }
      state.closedNow = true;
      return { ...current, localClosedReason: 'abandoned' };
    });
    if (state.blocked) {
      throw buildLocalError(EBinanceDepositLocalErrorCode.ReportPending);
    }
    if (stored && state.closedNow) {
      await this.releaseSessionSecrets(stored, 'abandoned');
    }
  }

  // For the app reset only, before simpleDb is wiped: the session keys in
  // secure storage are indexed by nothing but the simpleDb records, so they
  // could never be found again afterwards. Never throws; a reset must not
  // depend on this cleanup.
  async purgeAllSessionKeysForReset(): Promise<void> {
    try {
      // Stop the loops first: they hold the nonces and would keep reading the
      // keys removed below.
      this.bindJobs.forEach((job, localId) => {
        this.endBindJob(localId, job);
      });
      this.links.clear();
      this.nonceDigests.clear();
      this.createAttempts.clear();
    } catch {
      // Keep going: the keys below matter more.
    }
    let sessions: IBinanceDepositLocalSession[] = [];
    try {
      ({ sessions } = await this.db.getSessionList());
    } catch {
      // Without the records there is no key name to remove.
      return;
    }
    for (const session of sessions) {
      try {
        await this.releaseSessionSecrets(session, 'app_reset');
      } catch {
        // Go on with the next key.
      }
    }
  }

  // The UI runtime drops a return whose `rn` it cannot parse without ever
  // calling handleDepositReturn. This only puts that fact next to the other
  // steps in the local log and the debug events; it takes no nonce and no
  // URL, and it touches no session.
  @backgroundMethod()
  async recordReturnDiscardedByMain(params: {
    reason: string;
    otherParamNames: string[];
    source: IBinanceDepositReturnSource;
  }): Promise<void> {
    const input: Partial<typeof params> = params ?? {};
    this.track('returnDiscarded', {
      source: normalizeReturnSource(input.source),
      reason: normalizeMainDiscardReason(input.reason),
      otherParamNames: normalizeParamNames(input.otherParamNames),
      byMain: true,
    });
  }

  // Deposit-enabled assets the app can actually send. An asset is left out
  // when the network's vault only builds native transfers but the asset has a
  // contract, when it is a native coin listed under a placeholder contract,
  // and a whole network is left out when the app has no vault for it.
  @backgroundMethod()
  async getDepositAssets(): Promise<IBinanceDepositAssetNetwork[]> {
    const assets: unknown =
      await this.backgroundApi.serviceToken.getBinanceSupportedAssets();
    const networks: IBinanceDepositAssetNetwork[] = [];
    if (!isRecord(assets)) {
      return networks;
    }
    for (const [networkId, symbolMap] of Object.entries(assets)) {
      const symbols: IBinanceDepositAssetSymbol[] = [];
      if (isRecord(symbolMap)) {
        Object.entries(symbolMap).forEach(([symbol, info]) => {
          if (!isRecord(info) || info.depositEnable !== true) {
            return;
          }
          // The symbol key is used verbatim: the server compares it
          // case-sensitively on create.
          const item: IBinanceDepositAssetSymbol = { symbol };
          const contractAddress = pickOptionalString(info.contractAddress);
          if (contractAddress) {
            item.contractAddress = contractAddress;
          }
          if (typeof info.requiresAddressTag === 'boolean') {
            item.requiresAddressTag = info.requiresAddressTag;
          }
          const depositDust = parseDepositDust(info.depositDust);
          if (depositDust !== undefined) {
            item.depositDust = depositDust;
          }
          symbols.push(item);
        });
      }
      if (symbols.length > 0) {
        const isSingleToken = await this.getIsSingleTokenNetwork(networkId);
        const sendable =
          isSingleToken === undefined
            ? []
            : symbols.filter(
                (item) =>
                  !getBinanceDepositAssetBlockReason({
                    networkId,
                    contractAddress: item.contractAddress,
                    isSingleToken,
                  }),
              );
        if (sendable.length > 0) {
          networks.push({ networkId, symbols: sendable });
        }
      }
    }
    return networks;
  }
}
