import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';
import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';

import type { IMarketCategoryItem } from '../../../Market/MarketHomeV2/types';
import type { IHomeMarketLegacyPayload } from '../../model/sections/market/homeMarketSourceAdapter';

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

type IHomePopularTradingPayload = Omit<
  IHomeMarketLegacyPayload<IFavoriteTokenDisplay>,
  'categories' | 'rows' | 'watchListItems'
> & {
  categories: IMarketCategoryItem[];
  perpsHotRows: IFavoriteTokenDisplay[];
  rows: IFavoriteTokenDisplay[];
  watchListItems: IMarketWatchListItemV2[];
};

export type { IFavoriteTokenDisplay, IHomePopularTradingPayload };
