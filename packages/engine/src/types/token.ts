import { HasName } from './base';

export type ServerToken = {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  logoURI: string;
  impl: string;
  status: 'LISTED' | 'DRAFT' | 'TRASH';
  verified: boolean;
  security: boolean;
  addToIndex: boolean;
  chainId: number;
  source: string[];
  checked: boolean;
  marketCap: number;
};

export type Token = HasName & {
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
