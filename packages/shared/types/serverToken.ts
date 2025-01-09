import type { IFetchAccountTokensResp, IFetchTokenDetailItem } from './token';

type IFiatAmount = string;
export type IAmountUnit = string;
type IAmount = string;
type IFloat = number;
type IAddress = string;
type IInteger = number;

interface IServerPriceItem {
  price: IFiatAmount;
  price24h: IFloat;
}

export interface IServerTokenInfo {
  name?: string;
  symbol?: string;
  address: IAddress;
  sendAddress?: IAddress;
  decimals: IInteger;
  totalSupply?: IAmountUnit;
  logoURI?: string;
  isNative: boolean;
  riskLevel?: number | null;
  uniqueKey?: string;
  adaName?: string;
  networkId?: string;
}

export interface IServerTokenItemWithInfo extends IServerPriceItem {
  info?: IServerTokenInfo;
}

export interface IServerAccountTokenItem extends IServerTokenItemWithInfo {
  fiatValue: IFiatAmount;
  balance: IAmountUnit;
  balanceParsed: IAmount;
  frozenBalance?: string;
  frozenBalanceParsed?: string;
  frozenBalanceFiatValue?: IFiatAmount;
  availableBalance?: string;
  availableBalanceParsed?: string;
  availableBalanceFiatValue?: IFiatAmount;
}

export type IServerFiatTokenInfo = IServerTokenInfo &
  Partial<IServerAccountTokenItem>;

export interface IServerTokenListQuery {
  networkId: string;
  contractList?: string[];
  keywords?: string;
  limit?: number;
}

export interface IFetchServerTokenListParams {
  accountId: string;
  requestApiParams: IFetchServerTokenListApiParams;
  flag?: string;
  signal?: AbortSignal;
}

export type IFetchServerTokenListApiParams = {
  networkId: string;
  cursor?: string;
  limit?: number;
  hideSmallBalanceTokens?: boolean;
  hideRiskTokens?: boolean;
  contractList?: string[];
  hiddenTokens?: string[];
  accountAddress: string;
  xpub?: string;
  isAllNetwork?: boolean;
  isForceRefresh?: boolean;
  onlyReturnSpecificTokens?: boolean;
};

export type IFetchServerTokenListResponse = {
  data: {
    data: IFetchAccountTokensResp;
  };
};

export interface IFetchServerTokenDetailParams {
  accountId?: string;
  walletId?: string;
  networkId: string;
  accountAddress?: string;
  xpub?: string;
  contractList?: string[];
  withCheckInscription?: boolean;
  withFrozenBalance?: boolean;
  keywords?: string;
  signal?: AbortSignal;
}

export interface IFetchServerTokenDetailResponse {
  data: {
    data: IFetchTokenDetailItem[];
  };
}
