import { Buffer } from 'buffer';

import {
  EBinanceDepositErrorCode,
  EBinanceDepositSessionStatus,
} from '../../types/exchange';
import {
  BINANCE_DEPOSIT_BIND_DISABLED_RETRY_INTERVAL_MS,
  BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
  BINANCE_DEPOSIT_BIND_WINDOW_MS,
  BINANCE_DEPOSIT_LINK_HOST_ALLOWLIST,
  BINANCE_DEPOSIT_LOG_LIST_MAX_ITEMS,
  BINANCE_DEPOSIT_LOG_REDACTED_PLACEHOLDER,
  BINANCE_DEPOSIT_LOG_STRING_MAX_LENGTH,
  BINANCE_DEPOSIT_NATIVE_PLACEHOLDER_CONTRACTS,
  BINANCE_DEPOSIT_PARAMS_ERROR_CODE,
  BINANCE_DEPOSIT_RETURN_GRACE_MS,
  BINANCE_DEPOSIT_RETURN_HOST,
  BINANCE_DEPOSIT_RETURN_MAX_OTHER_PARAM_NAMES,
  BINANCE_DEPOSIT_RETURN_NONCE_PARAM,
  BINANCE_DEPOSIT_RETURN_NONCE_REGEX,
  BINANCE_DEPOSIT_RETURN_PARAM_NAME_PLACEHOLDER,
  BINANCE_DEPOSIT_RETURN_PARAM_NAME_REGEX,
  BINANCE_DEPOSIT_RETURN_PATH,
  BINANCE_DEPOSIT_RETURN_SCHEME,
  BINANCE_DEPOSIT_SECURE_STORAGE_KEY_REGEX,
  BINANCE_DEPOSIT_SEND_ATTEMPT_ACK_HOLD_MS,
  BINANCE_DEPOSIT_SERVICE_ERROR_CODE,
  BINANCE_DEPOSIT_SESSION_ID_MASK_LENGTH,
  BINANCE_DEPOSIT_SESSION_KEY_REGEX,
  BINANCE_DEPOSIT_SESSION_KEY_STORAGE_PREFIX,
  BINANCE_DEPOSIT_TX_HASH_MASK_LENGTH,
} from '../consts/binanceDepositConsts';
import { OneKeyLocalError } from '../errors/errors/localError';

import type {
  IBinanceDepositAssetBlockReason,
  IBinanceDepositAuthorizedDestination,
  IBinanceDepositBindStep,
  IBinanceDepositBindStepInput,
  IBinanceDepositDebugEventDetail,
  IBinanceDepositLinkCheck,
  IBinanceDepositLinkRejectReason,
  IBinanceDepositLocalSession,
  IBinanceDepositLocalStatus,
  IBinanceDepositLogDetail,
  IBinanceDepositReturnUrlParseResult,
} from '../../types/exchange';

// Everything in this file is a pure function. It handles the return URL, the
// session key and the Binance link, so it must never log, report or throw an
// error carrying any of its inputs.

// ---- Return deep link ----

// Returns the raw query string of a deposit return URL, or undefined when the
// URL is not one. Works on the raw string only: Linking.parse decodes values
// twice and fails the whole parse on a stray '%'.
function getReturnUrlQuery(url: string): string | undefined {
  if (typeof url !== 'string') {
    return undefined;
  }
  const fragmentIndex = url.indexOf('#');
  const withoutFragment =
    fragmentIndex >= 0 ? url.slice(0, fragmentIndex) : url;
  const queryIndex = withoutFragment.indexOf('?');
  const base =
    queryIndex >= 0 ? withoutFragment.slice(0, queryIndex) : withoutFragment;
  const query = queryIndex >= 0 ? withoutFragment.slice(queryIndex + 1) : '';

  const schemeEnd = base.indexOf('://');
  if (
    schemeEnd <= 0 ||
    base.slice(0, schemeEnd).toLowerCase() !== BINANCE_DEPOSIT_RETURN_SCHEME
  ) {
    return undefined;
  }
  const afterScheme = base.slice(schemeEnd + 3);
  const hostEnd = afterScheme.indexOf('/');
  if (
    hostEnd < 0 ||
    afterScheme.slice(0, hostEnd).toLowerCase() !== BINANCE_DEPOSIT_RETURN_HOST
  ) {
    return undefined;
  }
  const path = afterScheme.slice(hostEnd + 1);
  if (
    path !== BINANCE_DEPOSIT_RETURN_PATH &&
    path !== `${BINANCE_DEPOSIT_RETURN_PATH}/`
  ) {
    return undefined;
  }
  return query;
}

export function isBinanceDepositReturnUrl(url: string): boolean {
  return getReturnUrlQuery(url) !== undefined;
}

export function parseBinanceDepositReturnUrl(
  url: string,
): IBinanceDepositReturnUrlParseResult {
  const query = getReturnUrlQuery(url);
  if (query === undefined) {
    return { otherParamNames: [], reason: 'not_return_url' };
  }

  const nonceValues: string[] = [];
  const otherParamNames: string[] = [];
  query.split('&').forEach((segment) => {
    if (!segment) {
      return;
    }
    const equalsIndex = segment.indexOf('=');
    const name = equalsIndex >= 0 ? segment.slice(0, equalsIndex) : segment;
    if (name === BINANCE_DEPOSIT_RETURN_NONCE_PARAM) {
      nonceValues.push(equalsIndex >= 0 ? segment.slice(equalsIndex + 1) : '');
      return;
    }
    // A name is as untrusted as a value (`?<nonce>` has no '=' at all), so
    // only short identifier-like names are passed on.
    const safeName = BINANCE_DEPOSIT_RETURN_PARAM_NAME_REGEX.test(name)
      ? name
      : BINANCE_DEPOSIT_RETURN_PARAM_NAME_PLACEHOLDER;
    if (
      otherParamNames.length < BINANCE_DEPOSIT_RETURN_MAX_OTHER_PARAM_NAMES &&
      !otherParamNames.includes(safeName)
    ) {
      otherParamNames.push(safeName);
    }
  });

  if (nonceValues.length === 0) {
    return { otherParamNames, reason: 'missing_rn' };
  }
  if (nonceValues.length > 1) {
    return { otherParamNames, reason: 'duplicate_rn' };
  }
  const [returnNonce] = nonceValues;
  // The charset needs no escaping, so a raw value that matches is the nonce
  // itself. Anything else is dropped rather than decoded and retried.
  if (!BINANCE_DEPOSIT_RETURN_NONCE_REGEX.test(returnNonce)) {
    return { otherParamNames, reason: 'malformed_rn' };
  }
  return { returnNonce, otherParamNames };
}

// ---- Binance link ----

const LINK_SCHEME_REGEX = /^([a-z][a-z0-9+.-]*):/i;
const LINK_HTTPS_PREFIX = 'https://';
const LINK_DEFAULT_PORT = '443';
// Printable ASCII without the backslash. WHATWG parsers fold '\' into '/' and
// drop tabs and newlines, native URL parsers do not, so a link carrying any of
// them could resolve to a different host once it is handed to the OS.
const LINK_SAFE_CHARS_REGEX = /^[\x21-\x5b\x5d-\x7e]+$/;

function getLinkRawRejectReason(
  link: string,
): IBinanceDepositLinkRejectReason | undefined {
  if (typeof link !== 'string' || !LINK_SAFE_CHARS_REGEX.test(link)) {
    return 'malformed';
  }
  const scheme = LINK_SCHEME_REGEX.exec(link)?.[1]?.toLowerCase();
  if (!scheme) {
    return 'malformed';
  }
  if (scheme !== 'https') {
    return 'not_https';
  }
  if (
    link.slice(0, LINK_HTTPS_PREFIX.length).toLowerCase() !== LINK_HTTPS_PREFIX
  ) {
    return 'malformed';
  }
  const afterScheme = link.slice(LINK_HTTPS_PREFIX.length);
  const authorityEnd = afterScheme.search(/[/?#]/);
  const authority =
    authorityEnd >= 0 ? afterScheme.slice(0, authorityEnd) : afterScheme;
  if (!authority) {
    return 'malformed';
  }
  if (authority.includes('@')) {
    return 'has_credentials';
  }
  const portIndex = authority.indexOf(':');
  const host = portIndex >= 0 ? authority.slice(0, portIndex) : authority;
  if (!BINANCE_DEPOSIT_LINK_HOST_ALLOWLIST.includes(host.toLowerCase())) {
    return 'host_not_allowed';
  }
  if (portIndex >= 0 && authority.slice(portIndex + 1) !== LINK_DEFAULT_PORT) {
    return 'port_not_allowed';
  }
  return undefined;
}

// The same checks the server runs, on the platform URL parser.
function getLinkParsedRejectReason(
  link: string,
): IBinanceDepositLinkRejectReason | undefined {
  try {
    const parsed = new URL(link);
    if (parsed.protocol !== 'https:') {
      return 'not_https';
    }
    if (parsed.username || parsed.password) {
      return 'has_credentials';
    }
    // The URL polyfill used on native keeps the host's case; Node and
    // browsers lowercase it.
    if (
      !BINANCE_DEPOSIT_LINK_HOST_ALLOWLIST.includes(
        parsed.hostname.toLowerCase(),
      )
    ) {
      return 'host_not_allowed';
    }
    // An explicit ':443' is normalized to an empty port.
    if (parsed.port !== '') {
      return 'port_not_allowed';
    }
    return undefined;
  } catch {
    return 'malformed';
  }
}

// Same acceptance criteria as the server: https, no userinfo, hostname exactly
// on the allowlist, no non-default port, expiry in the future. A link has to
// pass both a strict raw-string check and the URL parser, so a disagreement
// between parsers can only reject.
export function validateBinanceDepositLink(
  link: string,
  linkExpireTime?: number,
  now: number = Date.now(),
): IBinanceDepositLinkCheck {
  const reason =
    getLinkRawRejectReason(link) ?? getLinkParsedRejectReason(link);
  if (reason) {
    return { ok: false, reason };
  }
  if (
    typeof linkExpireTime !== 'number' ||
    !Number.isFinite(linkExpireTime) ||
    linkExpireTime <= 0
  ) {
    return { ok: false, reason: 'expiry_invalid' };
  }
  if (linkExpireTime <= now) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true };
}

// ---- Session key ----

const SESSION_KEY_BYTE_LENGTH = 32;

export function generateBinanceDepositSessionKey(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new OneKeyLocalError('Secure random source is unavailable');
  }
  const bytes = cryptoApi.getRandomValues(
    new Uint8Array(SESSION_KEY_BYTE_LENGTH),
  );
  // A stubbed RNG that leaves the buffer untouched would still encode to a
  // well-formed key.
  if (bytes.every((byte) => byte === 0)) {
    throw new OneKeyLocalError('Secure random source returned no entropy');
  }
  // Converted from standard base64 by hand: the Buffer polyfill used on
  // native has no 'base64url' encoding.
  const sessionKey = Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  if (!BINANCE_DEPOSIT_SESSION_KEY_REGEX.test(sessionKey)) {
    throw new OneKeyLocalError('Generated session key is malformed');
  }
  return sessionKey;
}

export function buildBinanceDepositSessionKeyStorageKey(
  localId: string,
): string {
  if (
    typeof localId !== 'string' ||
    !BINANCE_DEPOSIT_SECURE_STORAGE_KEY_REGEX.test(localId)
  ) {
    throw new OneKeyLocalError('Invalid Binance deposit local session id');
  }
  return `${BINANCE_DEPOSIT_SESSION_KEY_STORAGE_PREFIX}${localId}`;
}

// ---- Session status ----

type IBinanceDepositTerminalStatus =
  | EBinanceDepositSessionStatus.REJECTED
  | EBinanceDepositSessionStatus.EXPIRED
  | EBinanceDepositSessionStatus.SECURITY_CONFLICT;

const TERMINAL_STATUSES: ReadonlySet<string> =
  new Set<IBinanceDepositTerminalStatus>([
    EBinanceDepositSessionStatus.REJECTED,
    EBinanceDepositSessionStatus.EXPIRED,
    EBinanceDepositSessionStatus.SECURITY_CONFLICT,
  ]);

const IN_PROGRESS_STATUSES: ReadonlySet<string> =
  new Set<IBinanceDepositLocalStatus>([
    'LOCAL_PENDING_CREATE',
    EBinanceDepositSessionStatus.CREATING,
    EBinanceDepositSessionStatus.INIT,
    EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND,
  ]);

// Bind responses whose status may be mirrored locally while the nonce is
// still being retried. AUTHORIZED is left out on purpose: it is only stored
// together with its destination.
const BIND_RETRY_MIRRORED_STATUSES: ReadonlySet<EBinanceDepositSessionStatus> =
  new Set([
    EBinanceDepositSessionStatus.CREATING,
    EBinanceDepositSessionStatus.INIT,
    EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND,
  ]);

// AUTHORIZED is not terminal here: the session still has a report to deliver.
export function isBinanceDepositTerminalStatus(
  status?: string,
): status is IBinanceDepositTerminalStatus {
  return typeof status === 'string' && TERMINAL_STATUSES.has(status);
}

// At most one local session may be in one of these statuses at a time.
export function isBinanceDepositInProgressStatus(status?: string): boolean {
  return typeof status === 'string' && IN_PROGRESS_STATUSES.has(status);
}

// A locally closed session keeps its last status, so the status alone does
// not tell whether the session still occupies the in-progress slot.
export function isBinanceDepositSessionInProgress(
  session?: Pick<IBinanceDepositLocalSession, 'status' | 'localClosedReason'>,
): boolean {
  return (
    !!session &&
    !session.localClosedReason &&
    isBinanceDepositInProgressStatus(session.status)
  );
}

// Nothing more can be done with the server for this session, so its session
// key is no longer kept.
export function isBinanceDepositSessionClosed(
  session?: Pick<
    IBinanceDepositLocalSession,
    'status' | 'localClosedReason' | 'report'
  >,
): boolean {
  return (
    !!session &&
    (!!session.localClosedReason ||
      isBinanceDepositTerminalStatus(session.status) ||
      session.report?.status === 'CONFIRMED')
  );
}

// ---- Report ----

// A report rejected with one of these can never succeed for its session.
const REPORT_FINAL_ERROR_CODES: ReadonlySet<number> = new Set([
  EBinanceDepositErrorCode.ReportConflict,
  EBinanceDepositErrorCode.SecurityConflict,
  BINANCE_DEPOSIT_PARAMS_ERROR_CODE,
]);

export function isBinanceDepositReportFinalErrorCode(code?: number): boolean {
  return code !== undefined && REPORT_FINAL_ERROR_CODES.has(code);
}

// A FAILED report can be sent again by hand when it only ran out of automatic
// attempts: its session can still report and the server never refused the
// report for good.
export function canRearmBinanceDepositReport(
  session?: Pick<
    IBinanceDepositLocalSession,
    'sessionId' | 'status' | 'localClosedReason' | 'report'
  >,
): boolean {
  const report = session?.report;
  return (
    !!session &&
    report?.status === 'FAILED' &&
    !!session.sessionId &&
    session.status === EBinanceDepositSessionStatus.AUTHORIZED &&
    !isBinanceDepositSessionClosed(session) &&
    !isBinanceDepositReportFinalErrorCode(report.lastErrorCode)
  );
}

// ---- Send attempt ----

// How much longer the hold of a recorded signing attempt cannot be lifted, in
// milliseconds; 0 once it can be. Both values are readings of this device's
// clock, which also wrote the mark, so no server time is involved. A clock
// that was set back since gives a negative elapsed time, which counts as
// still on hold, and so does a value that is not a finite number.
export function getBinanceDepositSendAttemptAckWaitMs(
  sendAttemptedAt: number | undefined,
  now: number,
): number {
  if (sendAttemptedAt === undefined) {
    return 0;
  }
  const waitMs =
    sendAttemptedAt + BINANCE_DEPOSIT_SEND_ATTEMPT_ACK_HOLD_MS - now;
  if (!Number.isFinite(waitMs)) {
    return BINANCE_DEPOSIT_SEND_ATTEMPT_ACK_HOLD_MS;
  }
  return Math.max(0, waitMs);
}

// ---- Destination ----

export function compareBinanceDepositDestination(
  a?: IBinanceDepositAuthorizedDestination,
  b?: IBinanceDepositAuthorizedDestination,
): boolean {
  if (!a || !b || !a.address || !b.address) {
    return false;
  }
  return (
    a.address === b.address &&
    a.networkId === b.networkId &&
    a.binanceNetwork === b.binanceNetwork &&
    a.cryptoCurrency === b.cryptoCurrency &&
    a.minAmount === b.minAmount &&
    a.authorizedAt === b.authorizedAt &&
    // The server omits both fields when empty, so absent and '' are the same.
    (a.addressTag ?? '') === (b.addressTag ?? '') &&
    (a.contractAddress ?? '') === (b.contractAddress ?? '')
  );
}

// ---- Asset capability ----

// Decided from what the app's vault can send, never from what the token API
// returns for the listed contract. `isSingleToken` comes from the vault
// settings of `networkId`.
export function getBinanceDepositAssetBlockReason({
  networkId,
  contractAddress,
  isSingleToken,
}: {
  networkId: string;
  contractAddress?: string;
  isSingleToken: boolean;
}): IBinanceDepositAssetBlockReason | undefined {
  const contract =
    typeof contractAddress === 'string'
      ? contractAddress.trim().toLowerCase()
      : '';
  if (!contract) {
    return undefined;
  }
  if (isSingleToken) {
    return 'single_token_network';
  }
  if (BINANCE_DEPOSIT_NATIVE_PLACEHOLDER_CONTRACTS[networkId] === contract) {
    return 'native_placeholder_contract';
  }
  return undefined;
}

// ---- Bind decision ----

function pickTimestamp(
  ...candidates: Array<number | undefined>
): number | undefined {
  return candidates.find(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value) && value > 0,
  );
}

// Until when this device accepts the return and keeps retrying the bind. A
// bind deadline from the server is used as is. While only the link expiry is
// known, the grace covers the window the server may still open after it.
// Undefined when neither is known.
export function getBinanceDepositLocalBindDeadline({
  bindDeadline,
  linkExpireTime,
}: {
  bindDeadline?: number;
  linkExpireTime?: number;
}): number | undefined {
  const knownDeadline = pickTimestamp(bindDeadline);
  if (knownDeadline !== undefined) {
    return knownDeadline;
  }
  const expiry = pickTimestamp(linkExpireTime);
  return expiry === undefined
    ? undefined
    : expiry + BINANCE_DEPOSIT_RETURN_GRACE_MS;
}

function getBindRetryDeadline(input: IBinanceDepositBindStepInput): number {
  const { result, now, attempt } = input;
  const view = result.kind === 'view' ? result.view : undefined;
  const serverDeadline = getBinanceDepositLocalBindDeadline({
    bindDeadline: pickTimestamp(view?.bindDeadline, input.bindDeadline),
    linkExpireTime: pickTimestamp(view?.linkExpireTime, input.linkExpireTime),
  });
  if (serverDeadline !== undefined) {
    return serverDeadline;
  }
  const firstAttemptAt = pickTimestamp(input.firstAttemptAt);
  if (firstAttemptAt !== undefined) {
    return firstAttemptAt + BINANCE_DEPOSIT_BIND_WINDOW_MS;
  }
  // No clock reference at all. Every earlier attempt was followed by at least
  // one retry interval, which gives a lower bound for the time already spent
  // and keeps the loop finite.
  const earlierAttempts =
    Number.isFinite(attempt) && attempt > 1 ? attempt - 1 : 0;
  return (
    now -
    earlierAttempts * BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS +
    BINANCE_DEPOSIT_BIND_WINDOW_MS
  );
}

function retryUntilDeadline(
  input: IBinanceDepositBindStepInput,
  step: Pick<IBinanceDepositBindStep, 'reason' | 'delayMs' | 'nextStatus'>,
): IBinanceDepositBindStep {
  if (input.now >= getBindRetryDeadline(input)) {
    return { action: 'give_up', reason: 'deadline_passed' };
  }
  return { action: 'retry', ...step };
}

// Decides what to do after one bind call. Only a status the server reported
// as final ends the local session; a rejected nonce never does, so a forged
// or replayed return cannot break a valid session.
export function resolveBinanceDepositBindStep(
  input: IBinanceDepositBindStepInput,
): IBinanceDepositBindStep {
  const { result } = input;

  if (result.kind === 'view') {
    const { status, authorizedDestination } = result.view;
    if (
      status === EBinanceDepositSessionStatus.AUTHORIZED &&
      authorizedDestination?.address
    ) {
      return {
        action: 'authorized',
        reason: 'authorized',
        nextStatus: EBinanceDepositSessionStatus.AUTHORIZED,
      };
    }
    if (isBinanceDepositTerminalStatus(status)) {
      return {
        action: 'terminal',
        reason: 'server_terminal',
        nextStatus: status,
      };
    }
    if (status === EBinanceDepositSessionStatus.INIT) {
      // The server has not confirmed the authorization yet.
      return retryUntilDeadline(input, {
        reason: 'init_pending',
        delayMs: BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
        nextStatus: status,
      });
    }
    // CREATING, AUTHORIZED_UNBOUND, AUTHORIZED without a destination, or a
    // status this build does not know: nothing was released, nothing is final.
    return retryUntilDeadline(input, {
      reason: 'unexpected_view',
      delayMs: BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
      nextStatus: BIND_RETRY_MIRRORED_STATUSES.has(status) ? status : undefined,
    });
  }

  if (result.isNetworkError) {
    return retryUntilDeadline(input, {
      reason: 'network_error',
      delayMs: BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
    });
  }
  switch (result.code) {
    case EBinanceDepositErrorCode.BindProofInvalid:
      return { action: 'rejected_nonce', reason: 'nonce_rejected' };
    case BINANCE_DEPOSIT_PARAMS_ERROR_CODE:
      // The nonce and the key were format-checked before the call, so this
      // is `session not found`: unknown session id or a key that does not
      // own it.
      return { action: 'terminal', reason: 'session_not_found' };
    case EBinanceDepositErrorCode.DepositDisabled:
      // The server keeps the nonce while the switch is off.
      return retryUntilDeadline(input, {
        reason: 'deposit_disabled',
        delayMs: BINANCE_DEPOSIT_BIND_DISABLED_RETRY_INTERVAL_MS,
      });
    case BINANCE_DEPOSIT_SERVICE_ERROR_CODE:
      return retryUntilDeadline(input, {
        reason: 'service_error',
        delayMs: BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
      });
    default:
      return retryUntilDeadline(input, {
        reason: 'unexpected_error',
        delayMs: BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS,
      });
  }
}

// ---- Logging helpers ----

function maskIdentifier(value: string | undefined, length: number): string {
  if (typeof value !== 'string' || !value) {
    return '';
  }
  return `${value.slice(0, length)}…`;
}

export function maskBinanceDepositSessionId(sessionId?: string): string {
  return maskIdentifier(sessionId, BINANCE_DEPOSIT_SESSION_ID_MASK_LENGTH);
}

export function maskBinanceDepositTxHash(txHash?: string): string {
  return maskIdentifier(txHash, BINANCE_DEPOSIT_TX_HASH_MASK_LENGTH);
}

function sanitizeLogString(value: string): string {
  return value.length > BINANCE_DEPOSIT_LOG_STRING_MAX_LENGTH ||
    value.includes('://')
    ? BINANCE_DEPOSIT_LOG_REDACTED_PLACEHOLDER
    : value;
}

// Last line of defense for the deposit log and debug events: whatever a caller
// passes, no string long enough to be a session key or a return nonce, no URL
// and no object (a raw request error carries the request body) gets through.
export function sanitizeBinanceDepositLogDetail(
  detail: IBinanceDepositLogDetail,
): IBinanceDepositDebugEventDetail {
  const sanitized: IBinanceDepositDebugEventDetail = {};
  if (!detail || typeof detail !== 'object') {
    return sanitized;
  }
  Object.entries(detail as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    if (typeof value === 'string') {
      sanitized[key] = sanitizeLogString(value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = value
        .slice(0, BINANCE_DEPOSIT_LOG_LIST_MAX_ITEMS)
        .map((item: unknown) =>
          typeof item === 'string'
            ? sanitizeLogString(item)
            : BINANCE_DEPOSIT_LOG_REDACTED_PLACEHOLDER,
        )
        .join(',');
    } else {
      sanitized[key] = BINANCE_DEPOSIT_LOG_REDACTED_PLACEHOLDER;
    }
  });
  return sanitized;
}
