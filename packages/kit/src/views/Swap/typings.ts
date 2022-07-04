import { Account } from '@onekeyhq/engine/src/types/account';
import { Network } from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';

import type { SendConfirmPayloadBase } from '../Send/types';

export enum SwapRoutes {
  Swap = 'Swap',
  Input = 'Input',
  Output = 'Output',
  Preview = 'Preview',
  Settings = 'Settings',
  CustomToken = 'CustomToken',
  Transaction = 'Transaction',
  Webview = 'Webview',
}

export type SwapRoutesParams = {
  [SwapRoutes.Swap]: undefined;
  [SwapRoutes.Input]: undefined;
  [SwapRoutes.Output]: undefined;
  [SwapRoutes.Settings]: undefined;
  [SwapRoutes.Preview]: undefined;
  [SwapRoutes.Webview]: { url: string };
  [SwapRoutes.CustomToken]: { address?: string } | undefined;
  [SwapRoutes.Transaction]: {
    accountId: string;
    networkId: string;
    txid: string;
  };
};

export enum ApprovalState {
  UNKNOWN = 'UNKNOWN',
  NOT_APPROVED = 'NOT_APPROVED',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
}

export enum SwapError {
  QuoteFailed = 'QuoteFailed',
  InsufficientBalance = 'InsufficientBalance',
  NotSupport = 'NotSupport',
  DepositMax = 'DepositMax',
  DepositMin = 'DepositMin',
}

export type QuoteParams = {
  networkOut: Network;
  networkIn: Network;
  tokenOut: Token;
  tokenIn: Token;
  slippagePercentage: string;
  typedValue: string;
  independentField: 'INPUT' | 'OUTPUT';
};

export type SwapQuote = {
  instantRate: string;
  sellAmount: string;
  sellTokenAddress: string;
  buyAmount: string;
  buyTokenAddress: string;
  allowanceTarget?: string;
  depositMax?: string;
  depositMin?: string;
};

export type TxParams = {
  networkOut: Network;
  networkIn: Network;
  tokenOut: Token;
  tokenIn: Token;
  slippagePercentage: string;
  typedValue: string;
  independentField: 'INPUT' | 'OUTPUT';
  activeNetwok: Network;
  activeAccount: Account;
  receivingAddress?: string;
};

export type TxData = {
  from: string;
  to: string;
  data: string;
  value: string;
};

export type TxRes = {
  data?: TxData;
  resCode?: string;
  resMsg?: string;
  orderId?: string;
};

export type SwapQuoteTx = SendConfirmPayloadBase & SwapQuote & TxData;
export interface Quoter {
  isSupported(networkA: Network, networkB: Network): boolean;
  getQuote(params: QuoteParams): Promise<SwapQuote | undefined>;
  encodeTx(params: TxParams): Promise<TxRes | undefined>;
}

export interface SerializableTransactionReceipt {
  to: string;
  from: string;
  contractAddress: string;
  transactionIndex: number;
  blockHash: string;
  transactionHash: string;
  blockNumber: number;
  status?: string;
}

export type TransactionStatus = 'pending' | 'failed' | 'canceled' | 'sucesss';
export type TransactionType = 'approve' | 'swap';

export type TransactionToken = {
  networkId: string;
  token: Token;
  amount: string;
};
export interface TransactionDetails {
  hash: string;
  from: string;
  addedTime: number;
  networkId: string;
  accountId: string;
  type: TransactionType;
  status: TransactionStatus;
  archive?: boolean;
  approval?: { tokenAddress: string; spender: string; token: Token };
  tokens?: { from: TransactionToken; to: TransactionToken; rate: number };
  receipt?: SerializableTransactionReceipt;
  swftcReceipt?: SwftcTransactionReceipt;
  confirmedTime?: number;
  receivingAddress?: string;
  thirdPartyOrderId?: string;
  nonce?: number;
}

export interface SwftcTransactionReceipt {
  orderId: string;
  depositCoinCode: string;
  receiveCoinCode: string;
  platformAddr: string;
  detailState:
    | 'wait_deposit_send'
    | 'timeout'
    | 'wait_exchange_push'
    | 'wait_receive_send'
    | 'wait_receive_confirm'
    | 'receive_complete';
  tradeState: 'wait_deposits' | 'complete' | 'exchange';
  instantRate: string;
}
