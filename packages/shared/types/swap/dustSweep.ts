import type { ISwapNetwork, ISwapToken } from './types';

export const DUST_SWEEP_PROVIDER = 'SwapOKX';

export type IDustSweepEntry = 'lowValueRow' | 'tokenListHeader';
export type IDustSweepRouteParams = {
  accountId?: string;
  indexedAccountId?: string;
  walletId: string;
  networkId?: string;
  entry: IDustSweepEntry;
};
export type IDustSweepThreshold = 1 | 10 | 100;
export type IDustSweepReason =
  | 'priceImpact'
  | 'valueDrop'
  | 'noQuote'
  | 'insufficientGas'
  | 'txFailed'
  | 'unknown';
export type IDustSweepToken = ISwapToken & {
  key: string;
  amount: string;
  valueUsd: string;
  suspicious: boolean;
};
export type IDustSweepNetwork = {
  network: ISwapNetwork;
  accountId: string;
  address: string;
  deriveAddressEncoding?: string;
  tokens: IDustSweepToken[];
  nativeToken: ISwapToken;
  /** Total USD value of the account's tokens on this network (risk tokens excluded). */
  balanceUsd: string;
  denySingleSwapProvider?: string;
};
export type IDustSweepItemStatus =
  | 'waiting'
  | 'preparing'
  | 'signing'
  | 'broadcasted'
  | 'success'
  | 'skipped'
  | 'failed'
  | 'unknown';
export type IDustSweepItem = {
  token: IDustSweepToken;
  status: IDustSweepItemStatus;
  /** Approval transactions already broadcast before a later signing cancel. */
  approvalTxIds?: string[];
  txId?: string;
  receivedAmount?: string;
  receiptUnavailable?: boolean;
  reason?: IDustSweepReason;
  message?: string;
  /** User-facing send API error while the transaction outcome is unresolved. */
  submissionErrorMessage?: string;
  providerErrorMessage?: string;
};
export type IDustSweepSnapshot = {
  id: string;
  accountId: string;
  address: string;
  networkId: string;
  deriveAddressEncoding?: string;
  nativeToken: ISwapToken;
  slippage: number;
  tokens: IDustSweepToken[];
  denySingleSwapProvider?: string;
};
