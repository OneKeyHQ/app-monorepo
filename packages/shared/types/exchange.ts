/**
 * Asset config for one symbol on one network. The deposit fields are absent
 * on payloads that only serve the withdraw flow.
 */
export interface IBinanceSupportedAssetInfo {
  withdrawEnable: boolean;
  // Upstream deposit switch AND the server-side deposit network allowlist.
  depositEnable?: boolean;
  binanceNetwork?: string;
  // Absent for native coins. A deposit create request echoes it verbatim.
  contractAddress?: string;
  // Documented as a decimal string; a JSON number has been seen as well.
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
  // Destination frozen on the server, but not released until the initiating
  // device binds with the return nonce. Carries no address.
  AUTHORIZED_UNBOUND = 'AUTHORIZED_UNBOUND',
  AUTHORIZED = 'AUTHORIZED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  SECURITY_CONFLICT = 'SECURITY_CONFLICT',
}

// Business codes in the response body; the HTTP status stays 200.
export enum EBinanceDepositErrorCode {
  ServiceError = 10_000,
  InvalidParams = 10_422,
  FeatureDisabled = 14_001,
  // Temporary. On bind the nonce stays valid until the bind deadline.
  DepositDisabled = 14_002,
  CapabilityStale = 14_003,
  SecurityConflict = 14_004,
  ReportConflict = 14_005,
  RateLimited = 14_006,
  BindProofInvalid = 14_007,
}

export interface IBinanceDepositAuthorizedDestination {
  networkId: string;
  binanceNetwork: string;
  cryptoCurrency: string;
  contractAddress?: string;
  // Decimal string. Transfers below it are blocked.
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
  // AUTHORIZED only.
  authorizedDestination?: IBinanceDepositAuthorizedDestination;
}

// ---- Binance Connect Deposit: local state ----

export interface IBinanceDepositAsset {
  networkId: string;
  // The supported-assets symbol key, verbatim.
  cryptoCurrency: string;
  contractAddress?: string;
  requiresAddressTag: boolean;
}

export type IBinanceDepositFailReason =
  | 'expired'
  | 'rejected'
  | 'conflict'
  | 'bind_invalid'
  | 'session_lost';

// Stored in simpleDb as plain text. Never holds the session key, the return
// nonce or the Binance link.
export interface IBinanceDepositLocalSession {
  // Also the suffix of the secure storage key that holds the session key.
  localId: string;
  // Absent until the server confirmed the create.
  sessionId?: string;
  networkId: string;
  cryptoCurrency: string;
  contractAddress?: string;
  requiresAddressTag: boolean;
  status: EBinanceDepositSessionStatus | 'LOCAL_PENDING_CREATE';
  createFailed?: boolean;
  linkExpireTime?: number;
  bindDeadline?: number;
  linkOpenedAt?: number;
  returnReceivedAt?: number;
  destination?: IBinanceDepositAuthorizedDestination;
  failReason?: IBinanceDepositFailReason;
  createdAt: number;
  updatedAt: number;
}

export type IBinanceDepositPhase =
  | 'creating'
  | 'create_failed'
  | 'awaiting'
  | 'confirming'
  | 'authorized'
  | 'failed';

// What the UI runtime gets to see of the local session.
export interface IBinanceDepositSnapshot {
  localId: string;
  phase: IBinanceDepositPhase;
  status: IBinanceDepositLocalSession['status'];
  networkId: string;
  cryptoCurrency: string;
  destination?: IBinanceDepositAuthorizedDestination;
  failReason?: IBinanceDepositFailReason;
}

// Carried from the recipient step to the amount page of the send flow.
export interface IBinanceDepositSendContext {
  localId: string;
  cryptoCurrency: string;
  minAmount?: string;
}
