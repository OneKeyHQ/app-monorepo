import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';

interface IFavoriteTokenDisplay {
  chainId: string;
  contractAddress: string;
  isNative: boolean;
  symbol: string;
  name: string;
  logoUrl: string;
  logoUrls?: string[];
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  perpsCoin?: string;
  maxLeverage?: number;
  perpsSubtitle?: string;
  communityRecognized?: boolean;
  stock?: IMarketStockInfo;
}

export type { IFavoriteTokenDisplay };
