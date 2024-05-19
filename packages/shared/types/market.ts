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
  image: string;
  priceChangePercentage24H: number;
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
  telegramUrl: string;
}

export interface IMarketTokenDetail {
  about: string;
  explorers: IMarketTokenExplorer[];
  links: IMarketDetailLinks;
  stats: IMarketDetailStats;
}

export type IMarketTokenChart = [number, number][];
