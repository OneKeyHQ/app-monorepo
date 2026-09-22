import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';

import { MARKET_STOCK_CATEGORY_ALL } from '../../layouts/marketStockCategoryUtils';

// The asset list endpoint filters Top coins sub-categories through `type`;
// `all` keeps the unfiltered Top coins request.
export function getMarketTopCoinsRequestType(categoryId?: string) {
  if (!categoryId || categoryId === MARKET_STOCK_CATEGORY_ALL) {
    return MARKET_TOP_COINS_CATEGORY_ID;
  }
  return categoryId;
}
