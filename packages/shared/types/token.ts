export type IToken = {
  decimals: number;
  name: string;
  symbol: string;
  address: string;
  logoURI?: string;
  isNative: boolean | undefined;
  riskLevel?: number;
  sendAddress?: string;
};

export type ITokenFiat = {
  balance: string;
  balanceParsed: string;
  availableBalance?: string;
  availableBalanceParsed?: string;
  frozenBalance?: string;
  frozenBalanceParsed?: string;
  fiatValue: string;
  availableBalanceFiatValue?: string;
  frozenBalanceFiatValue?: string;
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
  flag?: string;
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
};

export type IFetchTokenDetailParams = {
  networkId: string;
  xpub?: string;
  contractList: string[];
  accountAddress?: string;
  withFrozenBalance?: boolean;
  withCheckInscription?: boolean;
};

export type IFetchTokenDetailResp = IAccountToken[];
export type IFetchTokenDetailItem = {
  info: IToken;
} & ITokenFiat;
