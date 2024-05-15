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
  customTokens?: IMarketToken[];
}

export interface IMarketToken {
  coingeckoId: string;
  iconUrl: string;
  symbol: string;
  rankIndex?: number;
  name?: string;
}
