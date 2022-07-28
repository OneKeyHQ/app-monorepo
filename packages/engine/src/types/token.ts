import { HasName } from './base';

export type Token = HasName & {
  _id?: string;
  networkId: string;
  tokenIdOnNetwork: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  address?: string;
  impl?: string;
  chainId?: number;
  source?: string[];
  coingeckoId?: string;
  swftId?: string;
  marketCap?: number;
  verified?: boolean;
  security?: boolean;
  addToIndex?: boolean;
};
