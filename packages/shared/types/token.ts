export type IToken = {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  logoURI?: string;
  isNative?: boolean;
  riskLevel?: number;
};

export type ITokenFiat = {
  balance: string;
  balanceParsed: string;
  fiatValue: string;
  price: number;
  price24h?: number;
};

export type IAccountToken = { $key: string } & IToken;

export type IFetchAccountTokensParams = {
  networkId: string;
  accountAddress: string;
  xpub?: string;
  cursor?: string;
  limit?: number;
  hideSmallBalanceTokens?: boolean;
  hideRiskTokens?: boolean;
  contractList?: string[];
  blockedTokens?: string[];
  unblockedTokens?: string[];
};

export type ITokenData = {
  data: IAccountToken[];
  keys: string;
  map: Record<string, ITokenFiat>; // key: networkId_tokenAddress
  fiatValue?: string;
};

export type IFetchAccountTokensResp = {
  tokens: ITokenData;
  riskTokens: ITokenData;
  smallBalanceTokens: ITokenData;
};

export type IFetchTokenDetailParams = {
  networkId: string;
  contractList: string[];
  accountAddress?: string;
};

export type IFetchTokenDetailResp = IAccountToken[];
