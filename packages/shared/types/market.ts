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
