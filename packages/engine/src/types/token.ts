import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type {
  IAmountValue,
  ITokenPriceValue,
} from '@onekeyhq/kit/src/store/reducers/tokens';

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
export type IToken = Token;
export type ITokenFiatValuesInfo = {
  balance?: IAmountValue;
  availableBalance?: IAmountValue;
  transferBalance?: IAmountValue;
  price?: ITokenPriceValue;
  price24h?: ITokenPriceValue;
  value?: IAmountValue;
  value24h?: IAmountValue;
  usdValue?: IAmountValue;
};
export type IAccountTokenData = IToken & ITokenFiatValuesInfo;
export type Tool = {
  networkId: string;
  title: LocaleIds;
  desc: LocaleIds;
  logoURI: string;
  link: string;
};

export enum BRCTokenType {
  BRC20 = 'brc-20',
}

export enum BRC20TokenOperation {
  Mint = 'mint',
  Transfer = 'transfer',
  Deploy = 'deploy',
  InscribeTransfer = 'inscribeTransfer',
}
