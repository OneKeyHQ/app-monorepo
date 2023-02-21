import type { LocaleIds } from '@onekeyhq/components/src/locale';

import type { HasName } from './base';

export enum TokenRiskLevel {
  UNKNOWN = 0,
  VERIFIED = 1,
  WARN,
  DANGER,
}

export type ServerToken = {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  logoURI: string;
  impl: string;
  status: 'LISTED' | 'DRAFT' | 'TRASH';
  addToIndex: boolean;
  chainId: string;
  source: string[];
  checked: boolean;
  marketCap: number;
  isNative?: boolean;
  onramperId?: string;
  moonpayId?: string;
  riskLevel?: TokenRiskLevel;
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
  source?: string;
  coingeckoId?: string;
  swftId?: string;
  marketCap?: number;
  addToIndex?: boolean;
  autoDetected?: boolean;
  sendAddress?: string;
  onramperId?: string;
  moonpayId?: string;

  riskLevel?: TokenRiskLevel;
};

export type Tool = {
  networkId: string;
  title: LocaleIds;
  desc: LocaleIds;
  logoURI: string;
  link: string;
};
