/* eslint-disable spellcheck/spell-checker */
export interface IMarketTokenDetail {
  address: string;
  logoUrl: string;
  name: string;
  symbol: string;
  decimals: number;
  marketCap?: string;
  fdv?: string;
  tvl?: string;
  liquidity?: string;
  holders?: number;
  circulatingSupply?: string;
  extraData?: {
    website?: string;
    twitter?: string;
  };
  supportSwap?: {
    enable: boolean;
    warningMessage?: string;
  };
  price?: string;
  priceChange1mPercent?: string;
  priceChange5mPercent?: string;
  priceChange30mPercent?: string;
  priceChange1hPercent?: string;
  priceChange2hPercent?: string;
  priceChange4hPercent?: string;
  priceChange8hPercent?: string;
  priceChange24hPercent?: string;
  trade1mCount?: string;
  trade5mCount?: string;
  trade30mCount?: string;
  trade1hCount?: string;
  trade2hCount?: string;
  trade4hCount?: string;
  trade8hCount?: string;
  trade24hCount?: string;
  buy1mCount?: string;
  buy5mCount?: string;
  buy30mCount?: string;
  buy1hCount?: string;
  buy2hCount?: string;
  buy4hCount?: string;
  buy8hCount?: string;
  buy24hCount?: string;
  sell1mCount?: string;
  sell5mCount?: string;
  sell30mCount?: string;
  sell1hCount?: string;
  sell2hCount?: string;
  sell4hCount?: string;
  sell8hCount?: string;
  sell24hCount?: string;
  uniqueWallet1m?: string;
  uniqueWallet5m?: string;
  uniqueWallet30m?: string;
  uniqueWallet1h?: string;
  uniqueWallet2h?: string;
  uniqueWallet4h?: string;
  uniqueWallet8h?: string;
  uniqueWallet24h?: string;
  volume1m?: string;
  volume5m?: string;
  volume30m?: string;
  volume1h?: string;
  volume2h?: string;
  volume4h?: string;
  volume8h?: string;
  volume24h?: string;
  volume1hChangePercent?: string;
  volume2hChangePercent?: string;
  volume4hChangePercent?: string;
  volume8hChangePercent?: string;
  volume24hChangePercent?: string;
  vBuy1m?: string;
  vBuy5m?: string;
  vBuy30m?: string;
  vBuy1h?: string;
  vBuy2h?: string;
  vBuy4h?: string;
  vBuy8h?: string;
  vBuy24h?: string;
  vSell1m?: string;
  vSell5m?: string;
  vSell30m?: string;
  vSell1h?: string;
  vSell2h?: string;
  vSell4h?: string;
  vSell8h?: string;
  vSell24h?: string;
  lastUpdated?: number;
  communityRecognized?: boolean;
  [key: string]: unknown;
}

export interface IMarketChain {
  networkId: string;
  name: string;
  logoUrl: string;
  explorerUrl: string;
}

export interface IMarketChainsResponse {
  list: IMarketChain[];
  total: number;
}

export interface IMarketTokenListItemExtraData {
  website?: string;
  twitter?: string;
  [key: string]: unknown;
}

export interface IMarketTokenListItem {
  address: string;
  logoUrl?: string;
  name: string;
  symbol: string;
  decimals: number;
  marketCap?: string;
  fdv?: string;
  tvl?: string;
  holders?: number;
  extraData?: IMarketTokenListItemExtraData;
  price?: string;
  firstTradeTime?: string;
  priceChange1mPercent?: string;
  priceChange5mPercent?: string;
  priceChange30mPercent?: string;
  priceChange1hPercent?: string;
  priceChange2hPercent?: string;
  priceChange4hPercent?: string;
  priceChange8hPercent?: string;
  priceChange24hPercent?: string;
  trade1mCount?: string;
  trade5mCount?: string;
  trade30mCount?: string;
  trade1hCount?: string;
  trade2hCount?: string;
  trade4hCount?: string;
  trade8hCount?: string;
  trade24hCount?: string;
  buy1mCount?: string;
  buy5mCount?: string;
  buy30mCount?: string;
  buy1hCount?: string;
  buy2hCount?: string;
  buy4hCount?: string;
  buy8hCount?: string;
  buy24hCount?: string;
  sell1mCount?: string;
  sell5mCount?: string;
  sell30mCount?: string;
  sell1hCount?: string;
  sell2hCount?: string;
  sell4hCount?: string;
  sell8hCount?: string;
  sell24hCount?: string;
  uniqueWallet1m?: string;
  uniqueWallet5m?: string;
  uniqueWallet30m?: string;
  uniqueWallet1h?: string;
  uniqueWallet2h?: string;
  uniqueWallet4h?: string;
  uniqueWallet8h?: string;
  uniqueWallet24h?: string;
  volume1m?: string;
  volume5m?: string;
  volume30m?: string;
  volume1h?: string;
  volume2h?: string;
  volume4h?: string;
  volume8h?: string;
  volume24h?: string;
  volume1hChangePercent?: string;
  volume2hChangePercent?: string;
  volume4hChangePercent?: string;
  volume8hChangePercent?: string;
  volume24hChangePercent?: string;
  networkId?: string;
  liquidity?: string;
  chainId?: string;
  communityRecognized?: boolean;
}

export interface IMarketTokenListResponse {
  list: IMarketTokenListItem[];
  total: number;
}

export interface IMarketTokenKLineDataPoint {
  o: number; // open price
  h: number; // high price
  l: number; // low price
  c: number; // close price
  v: number; // volume
  t: number; // timestamp
}

export interface IMarketTokenKLineResponse {
  points: IMarketTokenKLineDataPoint[];
  total: number;
}

export interface IMarketTokenTransactionToken {
  symbol: string;
  amount: string;
  address: string;
  price: string;
}

export interface IMarketTokenTransaction {
  pairAddress: string;
  hash: string;
  owner: string;
  type: 'buy' | 'sell';
  timestamp: number;
  url: string;
  from: IMarketTokenTransactionToken;
  to: IMarketTokenTransactionToken;
  poolLogoUrl?: string;
  volumeUSD?: number;
}

export interface IMarketTokenTransactionsResponse {
  list: IMarketTokenTransaction[];
  hasMore?: boolean;
  total?: number;
  cursor?: string;
}

export interface IMarketAccountTokenTransactionParty {
  amount: string;
  address: string;
  symbol: string;
}

export interface IMarketAccountTokenTransaction {
  hash: string;
  type: 'buy' | 'sell';
  timestamp: number;
  amount: string;
  from: IMarketAccountTokenTransactionParty;
  to: IMarketAccountTokenTransactionParty;
}

export interface IMarketAccountTokenTransactionsResponse {
  list: IMarketAccountTokenTransaction[];
  hasMore?: boolean;
  total?: number;
  cursor?: string;
}

export interface IMarketTokenHolder {
  accountAddress: string;
  amount: string;
  fiatValue: string;
  /**
   * Percentage of the total token supply that this holder owns. The value is expressed as a string
   * representation of the percentage (e.g. "10.31" to represent 10.31%).
   */
  percentage?: string;
}

export interface IMarketTokenHoldersResponse {
  list: IMarketTokenHolder[];
}

export interface IMarketTokenBatchListResponse {
  list: IMarketTokenListItem[];
}

export interface IMarketTokenSecurityItem {
  value: boolean | number | string;
  content: string;
  riskType: 'safe' | 'caution' | 'normal' | 'risk';
}

// Simplified token security data - dynamic structure with any security keys
export type IMarketTokenSecurityData = {
  [securityKey: string]: IMarketTokenSecurityItem;
};

export interface IMarketTokenSecurityBatchResponse {
  [tokenAddress: string]: IMarketTokenSecurityData;
}

export interface IMarketBasicConfigNetwork {
  networkId: string;
  index: number;
  name: string;
  logoUrl: string;
  explorerUrl: string;
  chainId: string;
}

export interface IMarketBasicConfigToken {
  contractAddress: string;
  chainId: string;
  isNative: boolean;
  name: string;
  symbol: string;
  logo?: string;
}

export interface IMarketBasicConfigNetworkFeature {
  actionBar?: boolean;
  [key: string]: unknown;
}

export interface IMarketBasicConfigFeature {
  marketWebsocket?: {
    transactions?: boolean;
    price?: boolean;
  };
  [key: string]: unknown;
}

export interface IMarketBasicConfigData {
  tradingViewUrl: string;
  networkList: IMarketBasicConfigNetwork[];
  recommendTokens: IMarketBasicConfigToken[];
  searchRecommendTokens: IMarketBasicConfigToken[];
  refreshInterval: number;
  minLiquidity: number;
  networkFeature?: {
    [networkId: string]: IMarketBasicConfigNetworkFeature;
  };
  feature?: IMarketBasicConfigFeature;
}

export interface IMarketBasicConfigResponse {
  code: number;
  message: string;
  data: IMarketBasicConfigData;
}

export interface IMarketTokenDetailWebsocket {
  txs: boolean;
  kline: boolean;
}

export interface IMarketTokenDetailData {
  token: IMarketTokenDetail;
  websocket: IMarketTokenDetailWebsocket;
}

export interface IMarketTokenDetailResponse {
  code: number;
  message: string;
  data: IMarketTokenDetailData;
}

export interface IMarketAccountPortfolioItem {
  accountAddress: string;
  tokenAddress: string;
  amount: string;
  symbol: string;
  tokenPrice: string;
  totalPrice: string;
}

export interface IMarketAccountPortfolioResponse {
  list: IMarketAccountPortfolioItem[];
}

// Banner types
export interface IMarketBannerDescription {
  text: string;
  fontColor: string;
}

export interface IMarketBannerItem {
  _id: string;
  title: string;
  rank: number;
  mode: number;
  payload: string;
  miniBundlerVersion: string;
  backgroundColor: string;
  tokenListId: string;
  description?: IMarketBannerDescription;
  tokenLogos?: string[];
}

export interface IMarketBannerListResponse {
  total: number;
  data: IMarketBannerItem[];
}

export interface IMarketBannerTokenListItem extends IMarketTokenListItem {
  isNative?: boolean;
  tokenAge?: string;
}

export interface IMarketBannerTokenListResponse {
  list: IMarketBannerTokenListItem[];
}
