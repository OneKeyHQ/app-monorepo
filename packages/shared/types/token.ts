export type IToken = {
  decimals: number;
  name: string;
  symbol: string;
  address: string;
  logoURI?: string;
  isNative: boolean | undefined;
  riskLevel?: number;
  uniqueKey?: string;
  sendAddress?: string;

  // for all networks
  order?: number;
  networkId?: string;
  accountId?: string;
  allNetworkAccountId?: string;
  mergeAssets?: boolean;
};

export type ITokenFiat = {
  balance: string;
  balanceParsed: string;
  frozenBalance?: string;
  frozenBalanceParsed?: string;
  totalBalance?: string;
  totalBalanceParsed?: string;
  fiatValue: string;
  frozenBalanceFiatValue?: string;
  totalBalanceFiatValue?: string;
  price: number;
  price24h?: number;
};

export type IAccountToken = { $key: string } & IToken;
export type ICustomTokenItem = IAccountToken;

export type IFetchAccountTokensParams = {
  accountId: string;
  networkId: string;
  cursor?: string;
  limit?: number;
  hideSmallBalanceTokens?: boolean;
  hideRiskTokens?: boolean;
  contractList?: string[];
  hiddenTokens?: string[];
  flag?: string;
  isAllNetworks?: boolean;
  isManualRefresh?: boolean;

  allNetworksAccountId?: string;
  allNetworksNetworkId?: string;
};

export type ITokenData = {
  data: IAccountToken[];
  keys: string;
  map: Record<string, ITokenFiat>; // key: networkId_tokenAddress
  fiatValue?: string;
};

export type IFetchAccountTokensResp = {
  allTokens?: ITokenData;
  tokens: ITokenData;
  riskTokens: ITokenData;
  smallBalanceTokens: ITokenData;
  accountId?: string;
  networkId?: string;
  isSameAllNetworksAccountData?: boolean;
};

export type IFetchTokenDetailParams = {
  accountId: string;
  networkId: string;
  contractList: string[];
  withFrozenBalance?: boolean;
  withCheckInscription?: boolean;
};

export type ISearchTokensParams = {
  accountId: string;
  networkId: string;
  contractList?: string[];
  keywords?: string;
};

export type ISearchTokenItem = {
  info: IToken;
};

export type IFetchTokenDetailResp = IAccountToken[];
export type IFetchTokenDetailItem = {
  info: IToken;
} & ITokenFiat;
