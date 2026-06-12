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
  dappName?: string | null;
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
  // Pins the currency the server should return data in. When set, the value
  // is sent as the `x-onekey-request-currency` header override so the actual
  // HTTP request can't drift to a different currency between when the caller
  // captured it and when axios issues the call (e.g. user switching currency
  // mid-flight). Caller is expected to use this same value for downstream
  // normalization to keep the basis consistent.
  requestCurrency?: string;
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
  withoutDappToken?: boolean;
  withoutWalletToken?: boolean;
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
  // Same purpose as in IFetchServerTokenListParams: pin the server-side
  // pricing currency via an explicit header override so it can't drift.
  requestCurrency?: string;
}

export interface IFetchServerTokenDetailResponse {
  data: {
    data: IFetchTokenDetailItem[];
  };
}
