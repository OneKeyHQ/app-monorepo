interface IFavoriteTokenDisplay {
  chainId: string;
  contractAddress: string;
  isNative: boolean;
  symbol: string;
  name: string;
  logoUrl: string;
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  perpsCoin?: string;
  maxLeverage?: number;
}

export type { IFavoriteTokenDisplay };
