/**
 * WalletConnect Pay types.
 *
 * Structural mirrors of `@walletconnect/pay` API types so that UI code does
 * not depend on the SDK package directly. Keep field names in sync with the
 * SDK when upgrading `@reown/walletkit`.
 */

export enum EWcPayStatus {
  RequiresAction = 'requires_action',
  Processing = 'processing',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Expired = 'expired',
  Cancelled = 'cancelled',
}

export enum EWcPayActionMethod {
  EthSendTransaction = 'eth_sendTransaction',
  EthSignTypedDataV4 = 'eth_signTypedData_v4',
  PersonalSign = 'personal_sign',
  SolanaSignTransaction = 'solana_signTransaction',
}

export interface IWcPayAmountDisplay {
  assetSymbol: string;
  assetName: string;
  decimals: number;
  iconUrl?: string;
  networkIconUrl?: string;
  networkName?: string;
}

export interface IWcPayAmount {
  unit: string;
  // raw amount in the smallest unit
  value: string;
  display: IWcPayAmountDisplay;
}

export interface IWcPayMerchantInfo {
  name: string;
  iconUrl?: string;
}

export interface IWcPayCollectDataField {
  id: string;
  name: string;
  required: boolean;
  fieldType: 'text' | 'date' | 'checkbox';
}

export interface IWcPayCollectData {
  fields: IWcPayCollectDataField[];
  // hosted form url; when present the form must be shown in a webview/iframe
  // BEFORE fetching required actions
  url?: string;
  schema?: string;
}

export interface IWcPayWalletRpcAction {
  // CAIP-2, e.g. "eip155:8453"
  chainId: string;
  method: string;
  // JSON-encoded params
  params: string;
}

export interface IWcPayAction {
  walletRpc: IWcPayWalletRpcAction;
}

// Identity of one durable-progress slot, handed to the send pipeline so the
// background can record a broadcast action's txid between signing and
// broadcast (the duplicate-payment boundary); mirrors the parameters of
// ServiceWalletConnectPay.recordActionResult
export interface IWcPayPreBroadcastRecord {
  paymentId: string;
  optionId: string;
  // indexedAccountId ?? accountId of the signing account
  accountKey: string;
  action: IWcPayAction;
  index: number;
}

export interface IWcPayInfo {
  status: EWcPayStatus;
  amount: IWcPayAmount;
  expiresAt: number;
  merchant: IWcPayMerchantInfo;
}

export interface IWcPayOption {
  id: string;
  // CAIP-10 account this option would spend from
  account: string;
  amount: IWcPayAmount;
  etaS: number;
  expiresAt?: number;
  actions: IWcPayAction[];
  collectData?: IWcPayCollectData;
}

export interface IWcPayOptionsResult {
  paymentId: string;
  info?: IWcPayInfo;
  options: IWcPayOption[];
  collectData?: IWcPayCollectData;
}

export interface IWcPayResultInfo {
  txId: string;
  optionAmount: IWcPayAmount;
}

export interface IWcPayConfirmResult {
  status: EWcPayStatus;
  isFinal: boolean;
  pollInMs?: number;
  info?: IWcPayResultInfo;
}
