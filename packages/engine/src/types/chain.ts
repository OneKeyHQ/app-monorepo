import type { CurveName } from '../secret';

export type ChainInfo = {
  code: string;
  feeCode: string;
  impl: string;
  curve: CurveName;
  implOptions: { [key: string]: any };
  clients: Array<{ name: string; args: Array<any> }>;
};

export type CoinInfo = {
  code: string;
  chainCode: string;
  decimals: number;
  tokenAddress?: string;
  options?: { [key: string]: any };
};
