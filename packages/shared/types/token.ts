export type IToken = {
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
  fiatValue: string;
  price: number;
  price24h?: number;
};

export type IAccountToken = ITokenFiat & { info: IToken } & { $key: string };

export type IFetchAccountTokensParams = {
  networkId: string;
  accountAddress: string;
  xpub?: string;
  cursor?: string;
  limit?: number;
  hideSmallBalanceTokens?: boolean;
  hideRiskTokens?: boolean;
  contractList?: string[];
};

export type IFetchAccountTokensResp = {
  data: IAccountToken[];
  next: string;
};

export type IFetchAccountTokensForDeepRefreshResp = {
  tokens: IAccountToken[];
  keys: string[];
  map: {
    [key: string]: ITokenFiat;
  };
  next: string;
};

export type IFetchTokenDetailParams = {
  networkId: string;
  accountAddress: string;
  xpub?: string;
  address: string;
  isNative: boolean;
};

export type IFetchTokenDetailResp = IAccountToken;
