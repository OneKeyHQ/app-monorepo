import type { IMarketCategoryItem } from '../../../Market/MarketHomeV2/types';

const FAVORITES_CATEGORY_ID = 'favorites';
const HOME_WATCHLIST_TAB_TYPE = 'watchlist';
const DEFAULT_MARKET_CATEGORY_ID = 'trending';
const DEFAULT_SPOT_CATEGORIES: IMarketCategoryItem[] = [
  { id: 'trending', name: 'Trending' },
  { id: 'x_mentioned', name: 'X Mentioned' },
];
const HOME_MARKET_CATEGORY_REQUEST_LIMIT = 3;

export {
  DEFAULT_MARKET_CATEGORY_ID,
  DEFAULT_SPOT_CATEGORIES,
  FAVORITES_CATEGORY_ID,
  HOME_MARKET_CATEGORY_REQUEST_LIMIT,
  HOME_WATCHLIST_TAB_TYPE,
};
