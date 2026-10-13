import { ONEKEY_APP_DEEP_LINK_NAME } from './deeplinkConsts';

export const BINANCE_DEPOSIT_API_PREFIX = '/wallet/v1/exchange/binance';

// Return deep link the server hands to Binance:
//   onekey-wallet://binance-connect/deposit-return?rn=<return nonce>
export const BINANCE_DEPOSIT_RETURN_SCHEME = ONEKEY_APP_DEEP_LINK_NAME;
export const BINANCE_DEPOSIT_RETURN_HOST = 'binance-connect';
export const BINANCE_DEPOSIT_RETURN_PATH = 'deposit-return';
export const BINANCE_DEPOSIT_RETURN_NONCE_PARAM = 'rn';

// Both patterns must stay identical to the server DTO: 32 random bytes as
// base64url without padding.
export const BINANCE_DEPOSIT_SESSION_KEY_REGEX = /^[A-Za-z0-9_-]{43}$/;
export const BINANCE_DEPOSIT_RETURN_NONCE_REGEX = /^[A-Za-z0-9_-]{43}$/;

// Exact hostname match only. Hard-coded on purpose: this is the trust boundary
// for where the user authorizes the deposit address.
export const BINANCE_DEPOSIT_LINK_HOST_ALLOWLIST: readonly string[] = [
  'app.binance.com',
  'www.binance.com',
];

// Generic wallet-service codes the deposit routes return next to
// EBinanceDepositErrorCode.
export const BINANCE_DEPOSIT_SERVICE_ERROR_CODE = 10_000;
export const BINANCE_DEPOSIT_PARAMS_ERROR_CODE = 10_422;

// Client-side codes, never sent by the server. On native only `code` and
// `message` of a background error reach the UI runtime, so the UI branches on
// these. Kept far outside the wallet-service range so they cannot collide.
export enum EBinanceDepositLocalErrorCode {
  // Another local session is still in progress; continue or abandon it first.
  SessionInProgress = 914_001,
  // The session key or the session record could not be generated, persisted
  // or read back on this device.
  StorageUnavailable = 914_002,
  // No business verdict was received (network error, timeout, non-2xx HTTP
  // status, malformed body). Safe to retry.
  RequestFailed = 914_003,
  SessionNotFound = 914_004,
  // The operation does not apply to the session's current state.
  InvalidSessionState = 914_005,
  // The session key is gone from secure storage; the session was closed.
  SessionKeyMissing = 914_006,
  // The Binance link did not pass the allowlist / expiry check.
  LinkRejected = 914_007,
  LinkUnavailable = 914_008,
  // The pre-sign query did not confirm the displayed destination.
  RevalidateFailed = 914_009,
  // A session with a pending report cannot be abandoned.
  ReportPending = 914_010,
  InvalidParams = 914_011,
  // The session was created on another wallet endpoint (test / prod). Nothing
  // was sent and nothing was changed; switching back makes it usable again.
  EndpointMismatch = 914_012,
  // Signing was already allowed to start for this session, or a transaction
  // is already recorded for it, so the pre-sign check refuses without asking
  // the server: an earlier transfer may be on chain.
  SendAttemptUnresolved = 914_013,
  // Secure storage would not hand out the session key. Never thrown: stored
  // as the last error of a report that could not be sent for that reason. Not
  // final, the report can be sent again once the key is readable.
  SessionKeyUnreadable = 914_014,
  // The hold a signing attempt puts on sending again cannot be lifted yet:
  // that transfer may still be signing or broadcasting.
  SendAttemptAckTooEarly = 914_015,
}

// The server confirms an authorization at most once every 3 seconds, so a
// bind that came back as INIT is retried just after that cooldown.
export const BINANCE_DEPOSIT_BIND_RETRY_INTERVAL_MS = 3200;
// Retry pace while the deposit switch is off (14002); the nonce stays valid.
export const BINANCE_DEPOSIT_BIND_DISABLED_RETRY_INTERVAL_MS = 5000;
// Server-side bind window after the destination is frozen. Also bounds the
// retries when the response carried no deadline at all.
export const BINANCE_DEPOSIT_BIND_WINDOW_MS = 10 * 60 * 1000;
// How long past `linkExpireTime` this device keeps accepting the return and
// retrying the bind while it has not learned a bind deadline: the server still
// confirms an INIT session for 2 minutes after its expiry and then opens the
// bind window. The server stays the authority; a bind that really came too
// late ends with an EXPIRED view or 14007.
export const BINANCE_DEPOSIT_RETURN_GRACE_MS =
  2 * 60 * 1000 + BINANCE_DEPOSIT_BIND_WINDOW_MS;

// Create may hit the upstream twice in sequence (30 seconds each), so it
// needs more than the default 30-second request timeout.
export const BINANCE_DEPOSIT_CREATE_TIMEOUT_MS = 75_000;
// main -> bg calls default to a 10-minute timeout; the return handler must
// not hold the deep link pipeline that long.
export const BINANCE_DEPOSIT_RETURN_HANDLE_TIMEOUT_MS = 15_000;
export const BINANCE_DEPOSIT_STATE_POLL_INTERVAL_MS = 1500;
// How long after signing was allowed to start the hold on sending again
// cannot be lifted. Signing and broadcasting may still be running in the
// background for that long, with the transfer not in the account history yet.
export const BINANCE_DEPOSIT_SEND_ATTEMPT_ACK_HOLD_MS = 90_000;

export const BINANCE_DEPOSIT_MAX_LOCAL_SESSIONS = 10;
export const BINANCE_DEPOSIT_MAX_DEBUG_EVENTS = 200;
export const BINANCE_DEPOSIT_MAX_REPORT_ATTEMPTS = 20;

// secureStorage key is `${prefix}${localId}`. expo-secure-store only accepts
// keys matching ^[\w.-]+$, so no ':' or '/' here.
export const BINANCE_DEPOSIT_SESSION_KEY_STORAGE_PREFIX = 'onekey_bcd_sk.';
export const BINANCE_DEPOSIT_SECURE_STORAGE_KEY_REGEX = /^[\w.-]+$/;

// Identifier prefix lengths used in logs and on screen. The native log layer
// replaces any 64-hex string (a sessionId, an EVM tx hash) with `[REDACTED]`,
// so only a short prefix is ever written.
export const BINANCE_DEPOSIT_SESSION_ID_MASK_LENGTH = 8;
export const BINANCE_DEPOSIT_TX_HASH_MASK_LENGTH = 10;

// Upper bound for any string written to the deposit log or debug events.
// Kept below the 43-char session key / return nonce length so neither can
// pass through a log field intact.
export const BINANCE_DEPOSIT_LOG_STRING_MAX_LENGTH = 40;
export const BINANCE_DEPOSIT_LOG_LIST_MAX_ITEMS = 8;
export const BINANCE_DEPOSIT_LOG_REDACTED_PLACEHOLDER = '[redacted]';

// Return URL parameter names are attacker-influenced; only short identifier
// like names are kept, anything else is replaced by the placeholder.
export const BINANCE_DEPOSIT_RETURN_PARAM_NAME_REGEX = /^[A-Za-z0-9_.-]{1,32}$/;
export const BINANCE_DEPOSIT_RETURN_PARAM_NAME_PLACEHOLDER = '[invalid]';
export const BINANCE_DEPOSIT_RETURN_MAX_OTHER_PARAM_NAMES = 8;

// Values of IBinanceDepositReturnResult.reason. The service produces them and
// the deep link handler in the UI runtime branches on them, so both sides take
// the spelling from here.
export const BINANCE_DEPOSIT_RETURN_REASON = {
  // Accepted without starting another bind.
  AlreadyBound: 'already_bound',
  Duplicate: 'duplicate',
  Queued: 'queued',
  // Discarded.
  MalformedNonce: 'malformed_rn',
  NoWaitingSession: 'no_waiting_session',
  NonceAlreadyRejected: 'nonce_already_rejected',
  QueueFull: 'queue_full',
  LocalError: 'local_error',
  // The waiting session lives on another wallet endpoint than the app uses
  // now. Nothing was stored and no bind was started.
  EndpointMismatch: 'endpoint_mismatch',
} as const;

export type IBinanceDepositReturnReason =
  (typeof BINANCE_DEPOSIT_RETURN_REASON)[keyof typeof BINANCE_DEPOSIT_RETURN_REASON];

// Discards that leave the return unresolved: a later delivery of the same URL
// may still get through, so the UI runtime must not treat them as settled.
export const BINANCE_DEPOSIT_RETURN_RETRYABLE_REASONS: ReadonlySet<string> =
  new Set<IBinanceDepositReturnReason>([
    BINANCE_DEPOSIT_RETURN_REASON.QueueFull,
    BINANCE_DEPOSIT_RETURN_REASON.LocalError,
    // Left unsettled, the URL stays in the native link cache. On iOS the
    // restart that switches the endpoint keeps the process, so the return is
    // read from there again when the self-test page opens back on the
    // session's endpoint. On Android that restart kills the process and the
    // cache with it: a return that arrived in the meantime cannot be
    // recovered, and the session has to be abandoned and created anew.
    BINANCE_DEPOSIT_RETURN_REASON.EndpointMismatch,
  ]);

// networkId -> lowercase contract address. Binance lists the native coin of
// these networks under a placeholder contract (POL on Polygon). The app sends
// a native coin only without a contract address, and the server requires the
// listed one to be echoed, so such an entry cannot be deposited from the app.
export const BINANCE_DEPOSIT_NATIVE_PLACEHOLDER_CONTRACTS: Readonly<
  Record<string, string>
> = {
  'evm--137': '0x0000000000000000000000000000000000001010',
};
