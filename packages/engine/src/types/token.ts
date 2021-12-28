import { HasName } from './base';

type Token = HasName & {
  networkId: string;
  tokenIdOnNetwork: string;
  symbol: string;
  decimals: number;
  logoURI: string;
};

export type { Token };
