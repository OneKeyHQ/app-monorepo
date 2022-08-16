import { Account } from '@onekeyhq/engine/src/types/account';
import { Network } from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';

import type { SendConfirmPayloadBase } from '../Send/types';

export enum SwapRoutes {
  Swap = 'Swap',
  Input = 'Input',
  Output = 'Output',
  Settings = 'Settings',
  CustomToken = 'CustomToken',
  Transaction = 'Transaction',
  Webview = 'Webview',
  Share = 'Share',
  SwftcHelp = 'SwftcHelp',
}

export type SwapRoutesParams = {
  [SwapRoutes.Swap]: undefined;
  [SwapRoutes.Input]: undefined;
  [SwapRoutes.Output]: undefined;
  [SwapRoutes.Settings]: undefined;
  [SwapRoutes.Webview]: { url: string };
  [SwapRoutes.SwftcHelp]: { orderid: string };
  [SwapRoutes.CustomToken]: { address?: string } | undefined;
  [SwapRoutes.Transaction]: {
    txid: string;
    goBack?: () => void;
  };
  [SwapRoutes.Share]: {
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

export enum QuoterType {
  swftc = 'swftc',
  socket = 'socket',
  mdex = 'mdex',
  zeroX = '0x',
}

export type FieldType = 'INPUT' | 'OUTPUT';

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
  independentField: FieldType;
  activeNetwok: Network;
  activeAccount: Account;
  receivingAddress?: string;
};

export type QuoteLimited = {
  max?: string;
  min?: string;
};

export type FetchQuoteResponse = {
  data?: QuoteData;
  limited?: QuoteLimited;
};

export type Provider = {
  name: string;
  logoUrl?: string;
};

export type QuoteData = {
  type: QuoterType;
  instantRate: string;
  sellAmount: string;
  sellTokenAddress: string;
  buyAmount: string;
  buyTokenAddress: string;
  allowanceTarget?: string;
  providers?: Provider[];
  txData?: TransactionData;
  txAttachment?: TransactionAttachment;
  arrivalTime?: number;
};

export interface TransactionAttachment {
  swftcOrderId?: string;
  socketUsedBridgeNames?: string[];
}

export type BuildTransactionParams = FetchQuoteParams & {
  txData?: TransactionData;
  txAttachment?: TransactionAttachment;
};

type BuildTransactionError = {
  code?: string;
  msg?: string;
};

export type BuildTransactionResponse = {
  data?: TransactionData;
  attachment?: TransactionAttachment;
  error?: BuildTransactionError;
};

export type SwapQuoteTx = SendConfirmPayloadBase & QuoteData & TransactionData;

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
  attachment?: TransactionAttachment;
  providers?: Provider[];
  arrivalTime?: number;
  destinationTransactionHash?: string;
}

export type TransactionProgress =
  | {
      status?: TransactionStatus;
      destinationTransactionHash?: string;
    }
  | undefined;

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
  transactionId?: string;
}

export interface Quoter {
  type: QuoterType;
  prepare?: () => void;
  isSupported(networkA: Network, networkB: Network): boolean;
  fetchQuote(params: FetchQuoteParams): Promise<FetchQuoteResponse | undefined>;
  buildTransaction(
    params: BuildTransactionParams,
  ): Promise<BuildTransactionResponse | undefined>;
  queryTransactionProgress(
    tx: TransactionDetails,
  ): Promise<TransactionProgress>;
}
