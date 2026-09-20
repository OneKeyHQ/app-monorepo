import type { ISwapNetwork, ISwapToken } from './types';

export type IDustSweepEntry = 'walletMore' | 'lowValueRow';
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
  tokens: IDustSweepToken[];
  nativeToken: ISwapToken;
  valueUsd: string;
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
  txId?: string;
  receivedAmount?: string;
  receiptUnavailable?: boolean;
  reason?: IDustSweepReason;
  message?: string;
};
export type IDustSweepSnapshot = {
  id: string;
  accountId: string;
  address: string;
  networkId: string;
  nativeToken: ISwapToken;
  slippage: number;
  tokens: IDustSweepToken[];
};
