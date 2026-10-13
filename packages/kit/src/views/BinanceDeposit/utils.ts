import BigNumber from 'bignumber.js';

import {
  BINANCE_DEPOSIT_MAX_DEBUG_EVENTS,
  BINANCE_DEPOSIT_PARAMS_ERROR_CODE,
  BINANCE_DEPOSIT_SERVICE_ERROR_CODE,
  EBinanceDepositLocalErrorCode,
} from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import {
  IMPL_EVM,
  IMPL_TRON,
  IMPL_XRP,
} from '@onekeyhq/shared/src/engine/engineConsts';
import {
  canRearmBinanceDepositReport,
  getBinanceDepositSendAttemptAckWaitMs,
  isBinanceDepositSessionClosed,
  isBinanceDepositSessionInProgress,
  isBinanceDepositTerminalStatus,
} from '@onekeyhq/shared/src/utils/binanceDepositUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IAddressValidateStatus } from '@onekeyhq/shared/types/address';
import {
  EBinanceDepositErrorCode,
  EBinanceDepositSessionStatus,
} from '@onekeyhq/shared/types/exchange';
import type {
  IBinanceDepositDebugEvent,
  IBinanceDepositDebugEventDetail,
  IBinanceDepositSessionSnapshot,
} from '@onekeyhq/shared/types/exchange';

export type IBinanceDepositBadgeType =
  | 'critical'
  | 'default'
  | 'info'
  | 'success'
  | 'warning';

// ---- error codes ----

// The service throws with `autoToast: false`, and on native only `code` and
// `message` of a background error reach this runtime. The page shows its own
// fixed text per code and never renders a message taken from an error object.
const ERROR_TEXTS: Partial<Record<number, string>> = {
  [BINANCE_DEPOSIT_SERVICE_ERROR_CODE]:
    'Service or upstream error. It is safe to retry.',
  [BINANCE_DEPOSIT_PARAMS_ERROR_CODE]:
    'The server rejected the request (invalid parameters or unknown session).',
  [EBinanceDepositErrorCode.FeatureDisabled]:
    'Binance Connect is switched off on the server.',
  [EBinanceDepositErrorCode.DepositDisabled]:
    'Deposit is temporarily switched off on the server.',
  [EBinanceDepositErrorCode.CapabilityStale]:
    'The asset list is out of date. It has been reloaded, pick the asset again.',
  [EBinanceDepositErrorCode.SecurityConflict]:
    'Security conflict reported by the server. Start a new deposit.',
  [EBinanceDepositErrorCode.ReportConflict]:
    'A different transaction is already reported for this session.',
  [EBinanceDepositErrorCode.RateLimited]:
    'Rate limited, or the server still holds an in-progress session for this asset.',
  [EBinanceDepositErrorCode.BindProofInvalid]:
    'The return proof was rejected, or the bind window has passed.',
  [EBinanceDepositLocalErrorCode.SessionInProgress]:
    'A session is already in progress. Continue or abandon it first.',
  [EBinanceDepositLocalErrorCode.StorageUnavailable]:
    'The session key could not be stored on this device (secure storage is unavailable, e.g. in Travel Mode).',
  [EBinanceDepositLocalErrorCode.RequestFailed]:
    'No answer from the server (network error or timeout). It is safe to retry.',
  [EBinanceDepositLocalErrorCode.SessionNotFound]:
    'The session no longer exists on this device.',
  [EBinanceDepositLocalErrorCode.InvalidSessionState]:
    'This action is not available in the current session state.',
  [EBinanceDepositLocalErrorCode.SessionKeyMissing]:
    'The session key is gone from secure storage. Start a new deposit.',
  [EBinanceDepositLocalErrorCode.LinkRejected]:
    'The Binance link did not pass the host or expiry check and was not opened.',
  [EBinanceDepositLocalErrorCode.LinkUnavailable]:
    'No Binance link is available for this session. Refresh or start a new deposit.',
  [EBinanceDepositLocalErrorCode.RevalidateFailed]:
    'The deposit address could not be re-verified. Start a new deposit.',
  [EBinanceDepositLocalErrorCode.ReportPending]:
    'This session still has a pending report and cannot be abandoned.',
  [EBinanceDepositLocalErrorCode.InvalidParams]: 'Invalid deposit parameters.',
  [EBinanceDepositLocalErrorCode.EndpointMismatch]:
    'This session was created on a different server environment. Switch back to that environment to continue.',
  [EBinanceDepositLocalErrorCode.SendAttemptUnresolved]:
    'An earlier transfer of this session may already have been sent. Check the account history before sending again.',
  [EBinanceDepositLocalErrorCode.SessionKeyUnreadable]:
    'The session key could not be read from secure storage. It may be readable again later.',
  [EBinanceDepositLocalErrorCode.SendAttemptAckTooEarly]:
    'Signing and broadcasting of the earlier transfer may still be in progress. Wait, then check the account history before confirming that it was not sent.',
};

const FALLBACK_ERROR_TEXT = 'Binance deposit request failed.';

// Short labels for the codes shown next to session fields.
const CODE_LABELS: Partial<Record<number, string>> = {
  0: 'ok',
  [BINANCE_DEPOSIT_SERVICE_ERROR_CODE]: 'service error',
  [BINANCE_DEPOSIT_PARAMS_ERROR_CODE]: 'rejected / unknown session',
  [EBinanceDepositErrorCode.FeatureDisabled]: 'feature disabled',
  [EBinanceDepositErrorCode.DepositDisabled]: 'deposit disabled',
  [EBinanceDepositErrorCode.CapabilityStale]: 'asset list stale',
  [EBinanceDepositErrorCode.SecurityConflict]: 'security conflict',
  [EBinanceDepositErrorCode.ReportConflict]: 'report conflict',
  [EBinanceDepositErrorCode.RateLimited]: 'rate limited / in progress',
  [EBinanceDepositErrorCode.BindProofInvalid]: 'bind proof rejected',
  [EBinanceDepositLocalErrorCode.SessionKeyUnreadable]:
    'session key unreadable',
};

export function getBinanceDepositErrorCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const { code } = error as { code?: unknown };
  return typeof code === 'number' && Number.isFinite(code) ? code : undefined;
}

// Only the numeric code of the error is read; its message is never used.
export function getBinanceDepositErrorText(error: unknown): string {
  const code = getBinanceDepositErrorCode(error);
  const text = code === undefined ? undefined : ERROR_TEXTS[code];
  if (!text) {
    return FALLBACK_ERROR_TEXT;
  }
  return `${text} (code ${String(code)})`;
}

export function formatBinanceDepositCode(code?: number): string {
  if (typeof code !== 'number') {
    return '-';
  }
  const label = CODE_LABELS[code];
  return label ? `${code} (${label})` : String(code);
}

// ---- session state ----

export type IBinanceDepositSessionFlags = {
  hasSession: boolean;
  isInProgress: boolean;
  isClosed: boolean;
  // Still owns the page: in progress, or authorized and not finished.
  isLive: boolean;
  // The session lives on another server environment than the app uses now.
  // The service refuses every call that would reach the server, so none of
  // them is offered; abandoning stays possible.
  isEndpointMismatch: boolean;
  canCreate: boolean;
  canRetryCreate: boolean;
  canOpenLink: boolean;
  canRefresh: boolean;
  canAbandon: boolean;
  canSend: boolean;
  // Signing was allowed to start earlier and no result was recorded. Sending
  // again stays off until the user confirms that transfer was not sent.
  needsSendAttemptAck: boolean;
  canRetryReport: boolean;
};

export function getBinanceDepositSessionFlags(
  session?: IBinanceDepositSessionSnapshot,
): IBinanceDepositSessionFlags {
  if (!session) {
    return {
      hasSession: false,
      isInProgress: false,
      isClosed: false,
      isLive: false,
      isEndpointMismatch: false,
      canCreate: true,
      canRetryCreate: false,
      canOpenLink: false,
      canRefresh: false,
      canAbandon: false,
      canSend: false,
      needsSendAttemptAck: false,
      canRetryReport: false,
    };
  }
  const { status, report } = session;
  const isInProgress = isBinanceDepositSessionInProgress(session);
  const isClosed = isBinanceDepositSessionClosed(session);
  const isLive = !isClosed;
  const isEndpointMismatch = Boolean(session.endpointMismatch);
  const canReachServer = !isEndpointMismatch;
  // The report slot holds a single transaction, so a session that already
  // has a report (in any state) must not send again.
  const isReadyToSend =
    isLive &&
    status === EBinanceDepositSessionStatus.AUTHORIZED &&
    !!session.destination?.address &&
    !report;
  const hasSendAttempt = typeof session.sendAttemptedAt === 'number';
  return {
    hasSession: true,
    isInProgress,
    isClosed,
    isLive,
    isEndpointMismatch,
    // One live session at a time on this page: an authorized session keeps
    // its released address visible until it is reported or abandoned.
    canCreate: !isLive,
    canRetryCreate:
      canReachServer &&
      isInProgress &&
      (status === 'LOCAL_PENDING_CREATE' ||
        status === EBinanceDepositSessionStatus.CREATING),
    // The server only returns a link while the session is INIT.
    canOpenLink:
      canReachServer &&
      isInProgress &&
      !!session.sessionId &&
      status === EBinanceDepositSessionStatus.INIT,
    canRefresh: canReachServer && isLive && !!session.sessionId,
    // Local only, so it does not depend on the server environment.
    canAbandon: isLive && report?.status !== 'PENDING',
    canSend: canReachServer && isReadyToSend && !hasSendAttempt,
    needsSendAttemptAck: isReadyToSend && hasSendAttempt,
    // A pending report is sent once more; a failed one only when it ran out
    // of automatic attempts and the server never refused it for good.
    canRetryReport:
      canReachServer &&
      (report?.status === 'PENDING' || canRearmBinanceDepositReport(session)),
  };
}

// Whole seconds until the service lets a recorded signing attempt be
// acknowledged, by the device clock; 0 once it does. Rounded up, so the page
// never offers the confirmation before the service accepts it.
export function getBinanceDepositSendAttemptAckWaitSeconds(
  session: Pick<IBinanceDepositSessionSnapshot, 'sendAttemptedAt'> | undefined,
  now: number,
): number {
  return Math.ceil(
    getBinanceDepositSendAttemptAckWaitMs(session?.sendAttemptedAt, now) / 1000,
  );
}

export function getBinanceDepositStatusBadgeType(
  session?: IBinanceDepositSessionSnapshot,
): IBinanceDepositBadgeType {
  if (!session) {
    return 'default';
  }
  if (isBinanceDepositTerminalStatus(session.status)) {
    return 'critical';
  }
  if (session.localClosedReason) {
    return 'default';
  }
  if (session.status === EBinanceDepositSessionStatus.AUTHORIZED) {
    return 'success';
  }
  if (session.status === EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND) {
    return 'warning';
  }
  return 'info';
}

export function getBinanceDepositStatusLabel(
  session?: IBinanceDepositSessionSnapshot,
): string {
  if (!session) {
    return 'NO SESSION';
  }
  // A locally closed session keeps the status it had when it was closed.
  return session.localClosedReason
    ? `${session.status} / closed: ${session.localClosedReason}`
    : session.status;
}

export function getBinanceDepositReportBadgeType(
  status?: 'PENDING' | 'CONFIRMED' | 'FAILED',
): IBinanceDepositBadgeType {
  if (status === 'CONFIRMED') {
    return 'success';
  }
  if (status === 'FAILED') {
    return 'critical';
  }
  if (status === 'PENDING') {
    return 'warning';
  }
  return 'default';
}

// One line telling the tester what the session is waiting for.
export function getBinanceDepositNextStepHint(
  session?: IBinanceDepositSessionSnapshot,
): string {
  if (!session) {
    return 'Pick a network and an asset, then create a session.';
  }
  const flags = getBinanceDepositSessionFlags(session);
  if (flags.isClosed) {
    return 'This session is finished. Create a new one to deposit again.';
  }
  if (flags.isEndpointMismatch) {
    return 'This session was created on another server environment. Switch the app back to that environment to continue, or abandon the session.';
  }
  if (flags.canRetryCreate) {
    return 'The create call is not confirmed yet. "Retry create" replays it with the same session key.';
  }
  if (session.hasPendingNonce) {
    return 'Return received. Binding runs in the background and retries until the deadline.';
  }
  if (flags.isInProgress) {
    if (!session.linkOpenedAt) {
      return 'Open Binance and authorize the deposit there.';
    }
    return session.awaitingReturn
      ? 'Waiting for the return from Binance. Finish the authorization there; the app binds when it is reopened by the return link.'
      : 'The return window has passed. Refresh to read the server status, or abandon the session.';
  }
  if (session.report?.status === 'PENDING') {
    return 'The transaction is sent and its report is pending. It is retried on foreground, or with "Retry report".';
  }
  if (session.report) {
    return flags.canRetryReport
      ? 'A transaction is recorded for this session, but its report ran out of automatic retries. "Retry report" sends it again.'
      : 'A transaction is recorded for this session but its report failed. Abandon the session to start over.';
  }
  if (flags.needsSendAttemptAck) {
    return 'An earlier transfer attempt has no recorded result. Check the account history before sending again.';
  }
  return 'Deposit address released. Enter an amount and review the transfer.';
}

// ---- time ----

function padTwoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatBinanceDepositCountdown(
  target: number | undefined,
  now: number,
): string {
  if (typeof target !== 'number' || !Number.isFinite(target) || target <= 0) {
    return '-';
  }
  const remainingMs = target - now;
  if (remainingMs <= 0) {
    return 'passed';
  }
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${padTwoDigits(totalSeconds % 60)}`;
}

export function formatBinanceDepositClockTime(timestamp?: number): string {
  if (
    typeof timestamp !== 'number' ||
    !Number.isFinite(timestamp) ||
    timestamp <= 0
  ) {
    return '-';
  }
  const date = new Date(timestamp);
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map(padTwoDigits)
    .join(':');
}

export function formatBinanceDepositDateTime(timestamp?: number): string {
  if (
    typeof timestamp !== 'number' ||
    !Number.isFinite(timestamp) ||
    timestamp <= 0
  ) {
    return '-';
  }
  const date = new Date(timestamp);
  const day = [
    String(date.getFullYear()),
    padTwoDigits(date.getMonth() + 1),
    padTwoDigits(date.getDate()),
  ].join('-');
  return `${day} ${formatBinanceDepositClockTime(timestamp)}`;
}

// ---- debug events ----

export function formatBinanceDepositEventDetail(
  detail?: IBinanceDepositDebugEventDetail,
): string {
  if (!detail) {
    return '';
  }
  return Object.entries(detail)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('  ');
}

// The polled snapshot carries a fresh copy of the event buffer every time.
// Comparing both ends is enough to tell whether the bounded, append-only
// buffer changed, and lets the page keep the previous array and skip
// re-rendering the list.
export function isSameBinanceDepositEventList(
  a: readonly IBinanceDepositDebugEvent[],
  b: readonly IBinanceDepositDebugEvent[],
): boolean {
  if (a.length !== b.length) {
    return false;
  }
  if (a.length === 0) {
    return true;
  }
  const firstA = a[0];
  const firstB = b[0];
  const lastA = a[a.length - 1];
  const lastB = b[b.length - 1];
  return (
    firstA.ts === firstB.ts &&
    firstA.step === firstB.step &&
    lastA.ts === lastB.ts &&
    lastA.step === lastB.step
  );
}

// Both inputs are in chronological order. The result is newest first.
export function mergeBinanceDepositEvents(
  backgroundEvents: readonly IBinanceDepositDebugEvent[],
  pageEvents: readonly IBinanceDepositDebugEvent[],
  limit: number = BINANCE_DEPOSIT_MAX_DEBUG_EVENTS,
): IBinanceDepositDebugEvent[] {
  return [...backgroundEvents, ...pageEvents]
    .toReversed()
    .toSorted((a, b) => b.ts - a.ts)
    .slice(0, limit);
}

// ---- amount ----

export type IBinanceDepositAmountRejectReason =
  | 'empty'
  | 'malformed'
  | 'not_positive'
  | 'too_many_decimals'
  | 'min_amount_invalid'
  | 'min_amount_unknown'
  | 'below_min'
  | 'balance_unavailable'
  | 'insufficient_balance';

export type IBinanceDepositAmountCheck =
  | { ok: true; amount: string }
  | { ok: false; reason: IBinanceDepositAmountRejectReason };

// Plain decimal only: no sign, no exponent, no thousands separator.
const AMOUNT_INPUT_REGEX = /^\d+(?:\.\d+)?$/;

// Where the enforced minimum comes from: the destination released with the
// deposit address, or the asset's deposit dust in the supported-assets list.
export type IBinanceDepositMinAmountSource = 'destination' | 'deposit_dust';

export type IBinanceDepositAmountFloor =
  | {
      ok: true;
      // Plain decimal string; absent when neither source sets a minimum.
      minAmount?: string;
      source?: IBinanceDepositMinAmountSource;
    }
  | {
      ok: false;
      // `min_amount_invalid`: the destination's minimum cannot be read.
      // `min_amount_unknown`: the destination sets none, and the asset list,
      // the only other source, could not be consulted for this asset.
      reason: 'min_amount_invalid' | 'min_amount_unknown';
    };

const MIN_AMOUNT_INVALID_TEXT =
  'The minimum deposit amount could not be read, so the transfer is blocked.';
const MIN_AMOUNT_UNKNOWN_TEXT =
  'The asset list is not loaded, or no longer lists this asset, so the minimum deposit amount is unknown and the transfer is blocked. Reload the asset list and try again.';

// The minimum that is actually enforced: the larger of the destination's
// `minAmount` and the asset's `depositDust`. The dust can only make the check
// stricter: it never lowers the destination's minimum, and a destination
// minimum that cannot be read still blocks, whatever the dust says. A dust
// value that is missing, zero or not a number adds nothing.
//
// `isAssetListReady` says that the supported-assets list is loaded and still
// carries the asset, which is the only case in which a missing `depositDust`
// means that the asset has none. Without it, and without a minimum from the
// destination, the minimum is unknown rather than absent, and that blocks.
// Left out, the list counts as not ready.
export function getBinanceDepositAmountFloor({
  minAmount,
  depositDust,
  isAssetListReady,
}: {
  minAmount?: string;
  depositDust?: string;
  isAssetListReady?: boolean;
}): IBinanceDepositAmountFloor {
  let floor: BigNumber | undefined;
  let source: IBinanceDepositMinAmountSource | undefined;
  if (minAmount !== undefined && minAmount !== '') {
    const minBN = new BigNumber(minAmount);
    if (!minBN.isFinite() || minBN.isNegative()) {
      return { ok: false, reason: 'min_amount_invalid' };
    }
    floor = minBN;
    source = 'destination';
  }
  // A minimum of zero protects no more than a missing one.
  if (!floor?.isGreaterThan(0) && !isAssetListReady) {
    return { ok: false, reason: 'min_amount_unknown' };
  }
  if (depositDust !== undefined && depositDust !== '') {
    // The service hands it over as a plain decimal string.
    const dustBN = new BigNumber(depositDust);
    if (
      dustBN.isFinite() &&
      dustBN.isGreaterThan(0) &&
      (!floor || dustBN.isGreaterThan(floor))
    ) {
      floor = dustBN;
      source = 'deposit_dust';
    }
  }
  return floor
    ? { ok: true, minAmount: floor.toFixed(), source }
    : { ok: true };
}

// One line for the Send section: the minimum in force and where it is from.
export function describeBinanceDepositAmountFloor(
  floor: IBinanceDepositAmountFloor,
): string {
  if (!floor.ok) {
    return floor.reason === 'min_amount_unknown'
      ? MIN_AMOUNT_UNKNOWN_TEXT
      : MIN_AMOUNT_INVALID_TEXT;
  }
  if (floor.minAmount === undefined) {
    return 'No minimum is set for this asset.';
  }
  return floor.source === 'deposit_dust'
    ? `Minimum ${floor.minAmount}, the deposit dust of this asset in the asset list (the deposit address sets no higher minimum).`
    : `Minimum ${floor.minAmount}, set with the deposit address.`;
}

// The minimum is a hard floor (see getBinanceDepositAmountFloor): a value
// that cannot be read, or that is not known, blocks the transfer instead of
// being skipped.
// `decimals` and `balance` are checked only when given, so the cheap checks
// can run before the token is fetched.
export function validateBinanceDepositAmount({
  amount,
  minAmount,
  depositDust,
  isAssetListReady,
  decimals,
  balance,
  checkBalance,
}: {
  amount: string;
  minAmount?: string;
  depositDust?: string;
  isAssetListReady?: boolean;
  decimals?: number;
  balance?: string;
  checkBalance?: boolean;
}): IBinanceDepositAmountCheck {
  const input = typeof amount === 'string' ? amount.trim() : '';
  if (!input) {
    return { ok: false, reason: 'empty' };
  }
  if (!AMOUNT_INPUT_REGEX.test(input)) {
    return { ok: false, reason: 'malformed' };
  }
  const amountBN = new BigNumber(input);
  if (!amountBN.isFinite()) {
    return { ok: false, reason: 'malformed' };
  }
  if (!amountBN.isGreaterThan(0)) {
    return { ok: false, reason: 'not_positive' };
  }

  const floor = getBinanceDepositAmountFloor({
    minAmount,
    depositDust,
    isAssetListReady,
  });
  if (!floor.ok) {
    return { ok: false, reason: floor.reason };
  }
  if (floor.minAmount !== undefined && amountBN.isLessThan(floor.minAmount)) {
    return { ok: false, reason: 'below_min' };
  }

  if (decimals !== undefined) {
    if (!Number.isInteger(decimals) || decimals < 0) {
      return { ok: false, reason: 'malformed' };
    }
    if ((amountBN.decimalPlaces() ?? 0) > decimals) {
      return { ok: false, reason: 'too_many_decimals' };
    }
  }

  if (checkBalance) {
    const balanceBN = new BigNumber(balance ?? '');
    if (!balanceBN.isFinite() || balanceBN.isNegative()) {
      return { ok: false, reason: 'balance_unavailable' };
    }
    if (amountBN.isGreaterThan(balanceBN)) {
      return { ok: false, reason: 'insufficient_balance' };
    }
  }

  return { ok: true, amount: amountBN.toFixed() };
}

const AMOUNT_REJECT_TEXTS: Record<IBinanceDepositAmountRejectReason, string> = {
  empty: 'Enter an amount.',
  malformed: 'Enter the amount as a plain decimal number.',
  not_positive: 'The amount must be greater than zero.',
  too_many_decimals: 'The amount has more decimals than the token supports.',
  min_amount_invalid: MIN_AMOUNT_INVALID_TEXT,
  min_amount_unknown: MIN_AMOUNT_UNKNOWN_TEXT,
  below_min: 'The amount is below the minimum deposit amount.',
  balance_unavailable: 'The token balance could not be loaded.',
  insufficient_balance: 'The amount exceeds the available balance.',
};

export function getBinanceDepositAmountRejectText(
  reason: IBinanceDepositAmountRejectReason,
): string {
  return AMOUNT_REJECT_TEXTS[reason];
}

// ---- transfer checks ----

const ADDRESS_REJECT_TEXTS: Record<
  Exclude<IAddressValidateStatus, 'valid'>,
  string
> = {
  unknown: 'The address check request failed. Try again.',
  invalid: 'The deposit address is not valid on this network.',
  'prohibit-send-to-self': 'This network does not allow sending to yourself.',
  'address-not-allowlist':
    'The transfer allowlist is on and the deposit address is not in the address book. Add it there or turn the allowlist off, then try again.',
};

export function getBinanceDepositAddressRejectText(
  status: Exclude<IAddressValidateStatus, 'valid'>,
): string {
  return ADDRESS_REJECT_TEXTS[status] ?? ADDRESS_REJECT_TEXTS.unknown;
}

// EVM contract addresses differ in case between sources; every other
// address family is case-sensitive.
export function isSameBinanceDepositAddress({
  networkId,
  a,
  b,
}: {
  networkId: string;
  a: string;
  b: string;
}): boolean {
  return networkUtils.isEvmNetwork({ networkId })
    ? a.toLowerCase() === b.toLowerCase()
    : a === b;
}

const HEX_64_REGEX = /^[0-9a-fA-F]{64}$/;
const PREFIXED_HEX_64_REGEX = /^0x[0-9a-fA-F]{64}$/;

// The report endpoint wants `0x` + 64 hex on EVM and bare 64 hex on TRON and
// XRP. Only that prefix is adjusted here; anything else is passed on as is
// and left for the server to judge.
export function normalizeBinanceDepositTxHash({
  networkId,
  txid,
}: {
  networkId: string;
  txid: string;
}): string {
  const value = txid.trim();
  const impl = networkUtils.getNetworkImpl({ networkId });
  if (impl === IMPL_EVM && HEX_64_REGEX.test(value)) {
    return `0x${value}`;
  }
  if (
    (impl === IMPL_TRON || impl === IMPL_XRP) &&
    PREFIXED_HEX_64_REGEX.test(value)
  ) {
    return value.slice(2);
  }
  return value;
}
