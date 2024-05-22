export interface IMarketCategory {
  categoryId: string;
  coingeckoIds: string[];
  name: string;
  type: string;
  recommendedTokens?: IMarketToken[];
  defaultSelected?: boolean;
  enable: boolean;
  origin: string;
  sequenceId: number;
  status?: string;
  coingeckoUrl?: string;
  customTokens?: IMarketCustomToken[];
}

export interface IMarketCustomToken {
  coingeckoId: string;
  iconUrl: string;
  symbol: string;
  rankIndex?: number;
  name?: string;
}

export interface IMarketToken {
  coingeckoId: string;
  name: string;
  serialNumber: number;
  price: number;
  totalVolume: number;
  marketCap: number;
  symbol: string;
  iconUrl: string;
  image: string;
  priceChangePercentage1H: number;
  priceChangePercentage24H: number;
  priceChangePercentage7D: number;
  sparkline: number[];
}

export interface IMarketDetailAth {
  time: Date;
  value: number;
}

export interface IMarketPerformance {
  priceChangePercentage1h: number;
  priceChangePercentage24h: number;
  priceChangePercentage7d: number;
  priceChangePercentage14d: number;
  priceChangePercentage30d: number;
  priceChangePercentage1y: number;
}

export interface IMarketDetailPlatform {
  [key: string]: {
    contract_address: string;
  };
}

export interface IMarketDetailStats {
  performance: IMarketPerformance;
  marketCap: number;
  marketCapRank: number;
  volume24h: number;
  trandingVolume: number;
  low24h: number;
  high24h: number;
  atl: IMarketDetailAth;
  ath: IMarketDetailAth;
  fdv: number;
  circulatingSupply: number;
  totalSupply: number;
  maxSupply: number;
  currentPrice: string;
}

export interface IMarketTokenExplorer {
  contractAddress: string;
  url: string;
  name: string;
}

export interface IMarketDetailLinks {
  homePageUrl: string;
  discordUrl: string;
  twitterUrl: string;
  whitepaper: string;
  telegramUrl: string;
}

export interface IMarketTokenDetail {
  name: string;
  image: string;
  symbol: string;
  about: string;
  explorers: IMarketTokenExplorer[];
  links: IMarketDetailLinks;
  stats: IMarketDetailStats;
  detail_platforms: IMarketDetailPlatform;
}

export type IMarketTokenChart = [number, number][];

export interface IMarketDetailPoolPriceChangePercentage {
  m5: string;
  h1: string;
  h6: string;
  h24: string;
}

export interface IMarketDetailPoolH1 {
  buys: number;
  sells: number;
  buyers: number | null;
  sellers: number | null;
}

export interface IMarketDetailPoolTransactions {
  m5: IMarketDetailPoolH1;
  m15: IMarketDetailPoolH1;
  m30: IMarketDetailPoolH1;
  h1: IMarketDetailPoolH1;
  h24: IMarketDetailPoolH1;
}

export enum EMarketDetailDataType {
  Dex = 'dex',
  Token = 'token',
}

export interface IMarketDetailData {
  id: string;
  type: EMarketDetailDataType;
}
export interface IMarketDetailPoolBaseToken {
  data: IMarketDetailData;
}

export enum EMarketDetailDatumType {
  Pool = 'pool',
}

export interface IMarketDetailPoolRelationships {
  base_token: IMarketDetailPoolBaseToken;
  quote_token: IMarketDetailPoolBaseToken;
  dex: IMarketDetailPoolBaseToken;
}

interface IMarketDetailPoolAttributes {
  base_token_price_usd: string;
  base_token_price_native_currency: string;
  quote_token_price_usd: string;
  quote_token_price_native_currency: string;
  base_token_price_quote_token: string;
  quote_token_price_base_token: string;
  address: string;
  name: string;
  pool_created_at: Date;
  fdv_usd: string;
  market_cap_usd: null | string;
  price_change_percentage: IMarketDetailPoolPriceChangePercentage;
  transactions: IMarketDetailPoolTransactions;
  volume_usd: IMarketDetailPoolPriceChangePercentage;
  reserve_in_usd: string;
}

export interface IMarketDetailPool {
  id: string;
  baseTokenImageUrl: string;
  onekeyNetworkId: string;
  quoteTokenImageUrl: string;
  type: EMarketDetailDatumType;
  attributes: IMarketDetailPoolAttributes;
  relationships: IMarketDetailPoolRelationships;
}

export interface IMarketWatchListItem {
  coingeckoId: string;
}
