import type { LocaleIds } from '@onekeyhq/components/src/locale';

import type { HasName } from './base';

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
  chainId: string;
  source: string[];
  checked: boolean;
  marketCap: number;
  isNative?: boolean;
};

export type Token = HasName & {
  isNative?: boolean;
  networkId: string;
  tokenIdOnNetwork: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  address?: string;
  impl?: string;
  chainId?: string;
  source?: string[];
  coingeckoId?: string;
  swftId?: string;
  marketCap?: number;
  verified?: boolean;
  security?: boolean;
  addToIndex?: boolean;
  autoDetected?: boolean;
};

export type Tool = {
  networkId: string;
  title: LocaleIds;
  desc: LocaleIds;
  logoURI: string;
  link: string;
};
