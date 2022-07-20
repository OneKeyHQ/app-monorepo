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
  SwftcHelp = 'SwftcHelp',
}

export type SwapRoutesParams = {
  [SwapRoutes.Swap]: undefined;
  [SwapRoutes.Input]: undefined;
  [SwapRoutes.Output]: undefined;
  [SwapRoutes.Settings]: undefined;
  [SwapRoutes.Preview]: undefined;
  [SwapRoutes.Webview]: { url: string };
  [SwapRoutes.SwftcHelp]: { orderid: string };
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

export type QuoterType = '0x' | 'swftc' | 'socket' | 'mdex';
export type IndependentFieldType = 'INPUT' | 'OUTPUT';

export type TransactionData = {
  from: string;
  to: string;
  data: string;
  value: string;
};

export type FetchQuoteParams = {
  networkOut: Network;
  networkIn: Network;
  tokenOut: Token;
  tokenIn: Token;
  slippagePercentage: string;
  typedValue: string;
  independentField: IndependentFieldType;
  activeNetwok: Network;
  activeAccount: Account;
  receivingAddress?: string;
};

export type QuoteData = {
  type: QuoterType;
  instantRate: string;
  sellAmount: string;
  sellTokenAddress: string;
  buyAmount: string;
  buyTokenAddress: string;
  allowanceTarget?: string;
  txData?: TransactionData;
  limited?: {
    max?: string;
    min?: string;
  };
};

export type BuildTransactionParams = FetchQuoteParams & {
  txData?: TransactionData;
};

type BuildTransactionError = {
  code?: string;
  msg?: string;
};

export type BuildTransactionResponse = {
  data?: TransactionData;
  error?: BuildTransactionError;
  orderId?: string;
};

export type SwapQuoteTx = SendConfirmPayloadBase & QuoteData & TransactionData;

export interface Quoter {
  type: QuoterType;
  prepare?: () => void;
  isSupported(networkA: Network, networkB: Network): boolean;
  fetchQuote(params: FetchQuoteParams): Promise<QuoteData | undefined>;
  buildTransaction(
    params: BuildTransactionParams,
  ): Promise<BuildTransactionResponse | undefined>;
  queryTransactionStatus(
    tx: TransactionDetails,
  ): Promise<TransactionStatus | undefined>;
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
  quoterType?: QuoterType;
  approval?: { tokenAddress: string; spender: string; token: Token };
  tokens?: { from: TransactionToken; to: TransactionToken; rate: number };
  receipt?: SerializableTransactionReceipt;
  swftcReceipt?: SwftcTransactionReceipt;
  confirmedTime?: number;
  receivingAddress?: string;
  thirdPartyOrderId?: string;
  nonce?: number;
}

export type SwftcTransactionState =
  | 'wait_deposit_send'
  | 'timeout'
  | 'wait_exchange_push'
  | 'wait_receive_send'
  | 'wait_receive_confirm'
  | 'receive_complete';

export type SwftcTradeState = 'wait_deposits' | 'complete' | 'exchange';

export interface SwftcTransactionReceipt {
  orderId: string;
  depositCoinCode: string;
  receiveCoinCode: string;
  platformAddr: string;
  detailState: SwftcTransactionState;
  tradeState: SwftcTradeState;
  instantRate: string;
}
