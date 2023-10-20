import type { TransactionWrapper } from './sdkCosmos';

export interface Coin {
  denom: string;
  amount: string;
}

export interface SignDocHex {
  bodyBytes: string;
  authInfoBytes: string;
  chainId: string;
  accountNumber: string;
}

export interface StdFee {
  amount: Coin[];
  gas_limit: string;
  payer: string;
  granter: string;

  feePayer?: string;
}

export type IEncodedTxCosmos = TransactionWrapper;
