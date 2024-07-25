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
  networkId?: string;
  accountId?: string;
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

export type IFetchAccountTokensParams = {
  accountId: string;
  networkId: string;
  cursor?: string;
  limit?: number;
  hideSmallBalanceTokens?: boolean;
  hideRiskTokens?: boolean;
  contractList?: string[];
  blockedTokens?: string[];
  unblockedTokens?: string[];
  hiddenTokens?: string[];
  flag?: string;
  isAllNetworks?: boolean;
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
  networkId?: string;
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
