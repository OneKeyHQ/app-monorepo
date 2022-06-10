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
}

export type SwapRoutesParams = {
  [SwapRoutes.Swap]: undefined;
  [SwapRoutes.Input]: undefined;
  [SwapRoutes.Output]: undefined;
  [SwapRoutes.Settings]: undefined;
  [SwapRoutes.Preview]: undefined;
  [SwapRoutes.CustomToken]: { address?: string } | undefined;
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
