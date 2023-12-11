export type IToken = {
  $key?: string;
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  logoURI: string;
  isNative: boolean;
  riskLevel: number;
};

export type ITokenFiat = {
  balance: string;
  balanceParsed: string;
  price: number;
  price24h: number;
  fiatValue: string;
};

export type IFetchAccountTokensParams = {
  networkId: string;
  accountAddress: string;
  xpub?: string;
  page?: number;
  pageSize?: 20;
  hideSmallBalanceTokens?: boolean;
  hideRiskTokens?: boolean;
  contractList?: string[];
};

export type IFetchAccountTokensResp = {
  data: IAccountToken[];
  page: number;
  pageSize: number;
  total: number;
};

export type IFetchAccountTokensForDeepRefreshResp = {
  tokens: IAccountToken[];
  keys: string[];
  map: {
    [key: string]: ITokenFiat;
  };
  page: number;
  pageSize: number;
  total: number;
};

export type IAccountToken = IToken & ITokenFiat;
