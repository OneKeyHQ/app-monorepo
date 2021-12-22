import { HasName } from './base';

type Token = HasName & {
  chainId: string;
  tokenId: string;
  symbol: string;
  decimals: number;
  logoURI: string;
};

export type { Token };
