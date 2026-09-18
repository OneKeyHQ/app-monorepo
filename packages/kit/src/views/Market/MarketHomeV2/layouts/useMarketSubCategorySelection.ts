import { useEffect, useState } from 'react';

import {
  MARKET_STOCK_CATEGORY_ALL,
  getDefaultMarketStockCategoryId,
} from './marketStockCategoryUtils';

import type { IMarketCategoryItem } from '../types';

/**
 * Selected chip of a config-driven sub-category row (Stocks, Top coins).
 * The selection is not persisted; when the configured list no longer
 * contains it, it falls back to `all` (or the first category).
 */
export function useMarketSubCategorySelection(
  categories: IMarketCategoryItem[],
) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    getDefaultMarketStockCategoryId(categories),
  );
  useEffect(() => {
    if (categories.length === 0) {
      if (selectedCategoryId !== MARKET_STOCK_CATEGORY_ALL) {
        setSelectedCategoryId(MARKET_STOCK_CATEGORY_ALL);
      }
      return;
    }

    if (!categories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId(getDefaultMarketStockCategoryId(categories));
    }
  }, [categories, selectedCategoryId]);

  return [selectedCategoryId, setSelectedCategoryId] as const;
}
