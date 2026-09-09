import type { IMarketCategoryItem } from '../types';

export const MARKET_STOCK_CATEGORY_ALL = 'all';

export function getDefaultMarketStockCategoryId(
  categories?: IMarketCategoryItem[],
) {
  if (
    categories?.some((category) => category.id === MARKET_STOCK_CATEGORY_ALL)
  ) {
    return MARKET_STOCK_CATEGORY_ALL;
  }
  return categories?.[0]?.id ?? MARKET_STOCK_CATEGORY_ALL;
}

export function getMarketStockCategoryRequestParam(categoryId: string) {
  return categoryId === MARKET_STOCK_CATEGORY_ALL ? undefined : categoryId;
}
