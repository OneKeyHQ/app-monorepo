import { HasName } from './base';

export type Token = HasName & {
  networkId: string;
  tokenIdOnNetwork: string;
  symbol: string;
  decimals: number;
  logoURI: string;
};
