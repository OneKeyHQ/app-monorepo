// cspell:ignore presign
import type { IBinanceDepositReturnReason } from '../src/consts/binanceDepositConsts';

/**
 * Asset config for one symbol on one network.
 * The deposit fields are optional: the Send Primary flow and older payloads
 * only carry `withdrawEnable`.
 */
export interface IBinanceSupportedAssetInfo {
  withdrawEnable: boolean;
  // Upstream deposit switch AND the server-side deposit network allowlist.
  depositEnable?: boolean;
  binanceNetwork?: string;
  // Absent for native coins. A deposit create request must echo it verbatim.
  contractAddress?: string;
  // Smallest amount Binance credits. The authorized destination's `minAmount`
  // is enforced as well; this one can only make the amount check stricter.
  // As received: the contract says a decimal string, the upstream has been
  // sending a JSON number. getDepositAssets accepts both.
  depositDust?: number | string;
  requiresAddressTag?: boolean;
}

/**
 * Binance supported assets response.
 * Key: networkId (e.g., "evm--56", "evm--1")
 * Value: Record of symbol -> asset config
 */
export type IBinanceSupportedAssets = Record<
  string,
  Record<string, IBinanceSupportedAssetInfo>
>;

export interface IBinancePreOrderResponse {
  orderId: string;
  externalOrderId: string;
  redirectUrl: string;
  linkExpireTime: number;
  withdrawWalletAddress: string;
}

export interface IBinancePreOrderParams {
  networkId: string;
  address: string;
  cryptoCurrency: string;
  requestedAmount?: string;
}

export interface IExchangeFilter {
  exchangeId: string;
  supportedAssets: IBinanceSupportedAssets;
}

// ---- Binance Connect Deposit: server contract ----

export enum EBinanceDepositSessionStatus {
  CREATING = 'CREATING',
  INIT = 'INIT',
  // Authorized upstream and destination frozen, but the address is not
  // released until the initiating device binds with the return nonce.
  AUTHORIZED_UNBOUND = 'AUTHORIZED_UNBOUND',
  AUTHORIZED = 'AUTHORIZED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  SECURITY_CONFLICT = 'SECURITY_CONFLICT',
}

// Business codes carried in the response body `code`; the HTTP status stays
// 200. The deposit routes also return two generic wallet-service codes that
// are not part of this enum: 10000 (service or upstream failure, retryable)
// and 10422 (invalid params, `session not found`, `session is not
// authorized`). See BINANCE_DEPOSIT_SERVICE_ERROR_CODE and
// BINANCE_DEPOSIT_PARAMS_ERROR_CODE.
export enum EBinanceDepositErrorCode {
  FeatureDisabled = 14_001,
  // Temporary: the deposit switch is off.
  DepositDisabled = 14_002,
  // The supported-assets list used to build the request is out of date.
  CapabilityStale = 14_003,
  SecurityConflict = 14_004,
  ReportConflict = 14_005,
  // Rate limited, or the caller already has an in-progress session.
  RateLimited = 14_006,
  // Wrong return nonce, or the bind window has elapsed.
  BindProofInvalid = 14_007,
}

export interface IBinanceDepositAuthorizedDestination {
  networkId: string;
  binanceNetwork: string;
  cryptoCurrency: string;
  contractAddress?: string;
  // Decimal string. Transfers below it must be blocked.
  minAmount?: string;
  address: string;
  addressTag?: string;
  authorizedAt: number;
}

export type IBinanceDepositServerReportStatus = 'PENDING' | 'CONFIRMED';

export interface IBinanceDepositSessionView {
  sessionId: string;
  status: EBinanceDepositSessionStatus;
  networkId: string;
  cryptoCurrency: string;
  contractAddress?: string;
  reportedTxHash?: string;
  reportStatus?: IBinanceDepositServerReportStatus;
  // INIT only.
  link?: string;
  linkExpireTime?: number;
  // AUTHORIZED_UNBOUND only.
  bindDeadline?: number;
  // AUTHORIZED only: the address is released by a successful bind.
  authorizedDestination?: IBinanceDepositAuthorizedDestination;
}

export interface IBinanceDepositReportResult {
  reportAccepted: boolean;
}

// ---- Binance Connect Deposit: local state ----

// `LOCAL_PENDING_CREATE` exists only on the device: the record and its session
// key are persisted before the create call so a timed-out create can be
// replayed with the same key.
export type IBinanceDepositLocalStatus =
  | EBinanceDepositSessionStatus
  | 'LOCAL_PENDING_CREATE';

export type IBinanceDepositLocalReportStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'FAILED';

export interface IBinanceDepositLocalReport {
  txHash: string;
  senderAddress: string;
  status: IBinanceDepositLocalReportStatus;
  attempts: number;
  lastErrorCode?: number;
  updatedAt: number;
}

// Stored in simpleDb as plain text. It must never hold the session key, the
// return nonce or the Binance link.
export interface IBinanceDepositLocalSession {
  // generateUUID(); also the secureStorage key suffix
  localId: string;
  // absent until create is confirmed by the server
  sessionId?: string;
  walletId?: string;
  // sender account on networkId
  accountId: string;
  indexedAccountId?: string;
  senderAddress: string;
  networkId: string;
  cryptoCurrency: string;
  contractAddress?: string;
  status: IBinanceDepositLocalStatus;
  // Wallet endpoint the session was created on. The session exists on that
  // environment only, so no request is sent for it while the app points at
  // another one. Absent on records written before the field existed.
  walletEndpoint?: string;
  linkExpireTime?: number;
  bindDeadline?: number;
  // set when the app opened the Binance link => awaiting return
  linkOpenedAt?: number;
  // a well-formed return was accepted (the nonce itself is never stored)
  returnReceivedAt?: number;
  bindAttempts?: number;
  lastBindCode?: number;
  // only once AUTHORIZED
  destination?: IBinanceDepositAuthorizedDestination;
  presignCheckedAt?: number;
  // Set right before signing was allowed to start. While it is set and there
  // is no report, an earlier transfer may have been broadcast without its
  // result reaching the app; cleared only by acknowledgeSendAttempt.
  sendAttemptedAt?: number;
  report?: IBinanceDepositLocalReport;
  lastErrorCode?: number;
  // e.g. 'abandoned', 'key_missing'
  localClosedReason?: string;
  createdAt: number;
  updatedAt: number;
}

export type IBinanceDepositDebugEventDetail = Record<
  string,
  string | number | boolean | undefined
>;

// In-memory diagnostics shown on the self-test page. Same content rules as
// the local log: no credential, nonce, URL or link.
export interface IBinanceDepositDebugEvent {
  ts: number;
  step: string;
  detail?: IBinanceDepositDebugEventDetail;
}

// Raw fields handed to sanitizeBinanceDepositLogDetail before they are logged
// or turned into a debug event. A string list is flattened into one string.
export type IBinanceDepositLogDetail = Record<
  string,
  string | number | boolean | undefined | readonly string[]
>;

// What the UI runtime is allowed to see of a session.
export interface IBinanceDepositSessionSnapshot extends IBinanceDepositLocalSession {
  awaitingReturn: boolean;
  hasPendingNonce: boolean;
  bindInFlight: boolean;
  sessionIdMasked: string;
  // The open session was created on another wallet endpoint than the one the
  // app currently uses. Every call that would reach the server is refused
  // until the app is switched back.
  endpointMismatch: boolean;
}

export interface IBinanceDepositState {
  active?: IBinanceDepositSessionSnapshot;
  recent: IBinanceDepositSessionSnapshot[];
  events: IBinanceDepositDebugEvent[];
}

export interface IBinanceDepositCreateSessionParams {
  networkId: string;
  // The symbol key from supported-assets, verbatim (case-sensitive).
  cryptoCurrency: string;
  contractAddress?: string;
  accountId: string;
  walletId?: string;
  indexedAccountId?: string;
  senderAddress: string;
}

export interface IBinanceDepositAssetSymbol {
  symbol: string;
  contractAddress?: string;
  requiresAddressTag?: boolean;
  // IBinanceSupportedAssetInfo.depositDust as a plain decimal string, whatever
  // form it arrived in. Always greater than zero; absent when the asset has
  // none or the value could not be read.
  depositDust?: string;
}

// Why a listed asset cannot be deposited from the app, whatever the token
// API says about it.
export type IBinanceDepositAssetBlockReason =
  // The network's vault only builds native transfers (e.g. XRP).
  | 'single_token_network'
  // A native coin listed under a placeholder contract (POL on Polygon).
  | 'native_placeholder_contract';

export interface IBinanceDepositAssetNetwork {
  networkId: string;
  symbols: IBinanceDepositAssetSymbol[];
}

// ---- Binance Connect Deposit: return deep link ----

export type IBinanceDepositReturnSource =
  | 'os_initial'
  | 'os_event'
  | 'foreground_fallback';

export type IBinanceDepositReturnUrlRejectReason =
  | 'not_return_url'
  | 'missing_rn'
  | 'duplicate_rn'
  | 'malformed_rn';

export interface IBinanceDepositReturnUrlParseResult {
  // Present only when the URL carries exactly one well-formed `rn`.
  returnNonce?: string;
  // Names only, never values.
  otherParamNames: string[];
  reason?: IBinanceDepositReturnUrlRejectReason;
}

export interface IBinanceDepositReturnParams {
  returnNonce: string;
  otherParamNames: string[];
  source: IBinanceDepositReturnSource;
}

export interface IBinanceDepositReturnResult {
  accepted: boolean;
  reason?: IBinanceDepositReturnReason;
}

// ---- Binance Connect Deposit: link check ----

export type IBinanceDepositLinkRejectReason =
  | 'malformed'
  | 'not_https'
  | 'has_credentials'
  | 'host_not_allowed'
  | 'port_not_allowed'
  | 'expiry_invalid'
  | 'expired';

export interface IBinanceDepositLinkCheck {
  ok: boolean;
  reason?: IBinanceDepositLinkRejectReason;
}

// ---- Binance Connect Deposit: bind decision ----

export type IBinanceDepositBindCallResult =
  | { kind: 'view'; view: IBinanceDepositSessionView }
  | { kind: 'error'; code?: number; isNetworkError?: boolean };

export interface IBinanceDepositBindStepInput {
  result: IBinanceDepositBindCallResult;
  now: number;
  bindDeadline?: number;
  linkExpireTime?: number;
  // 1-based count of bind calls made with this nonce, including this one.
  attempt: number;
  // When the first bind call with this nonce started. Bounds the retries
  // when neither deadline is known.
  firstAttemptAt?: number;
}

export type IBinanceDepositBindAction =
  | 'authorized'
  | 'retry'
  | 'terminal'
  | 'rejected_nonce'
  | 'give_up';

export type IBinanceDepositBindStepReason =
  | 'authorized'
  | 'init_pending'
  | 'unexpected_view'
  | 'deposit_disabled'
  | 'service_error'
  | 'network_error'
  | 'unexpected_error'
  | 'server_terminal'
  | 'session_not_found'
  | 'nonce_rejected'
  | 'deadline_passed';

export interface IBinanceDepositBindStep {
  action: IBinanceDepositBindAction;
  reason: IBinanceDepositBindStepReason;
  // Always set when action is 'retry'.
  delayMs?: number;
  // The server-side status to mirror locally, when the response carries one
  // that is safe to store.
  nextStatus?: EBinanceDepositSessionStatus;
}
