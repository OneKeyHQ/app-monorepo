import { useEffect } from 'react';

import { useMarketHomeSelection } from '../hooks/useMarketHomeSelection';

import { getDefaultMarketStockCategoryId } from './marketStockCategoryUtils';

import type { IMarketCategoryItem } from '../types';

/**
 * Selected chip of a config-driven sub-category row (Stocks, Top coins).
 * Restore the persisted selection before config loads. Once a nonempty config
 * settles, a removed category falls back to `all` (or the first category).
 */
export function useMarketSubCategorySelection(
  categories: IMarketCategoryItem[],
  selectionKey: 'selectedStockCategory' | 'selectedTopCoinsCategory',
  isConfigLoading?: boolean,
) {
  const [selectedCategoryId, setSelectedCategoryId] = useMarketHomeSelection(
    selectionKey,
    getDefaultMarketStockCategoryId(categories),
  );
  useEffect(() => {
    if (isConfigLoading !== false || categories.length === 0) {
      return;
    }

    if (!categories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId(getDefaultMarketStockCategoryId(categories));
    }
  }, [categories, isConfigLoading, selectedCategoryId, setSelectedCategoryId]);

  return [selectedCategoryId, setSelectedCategoryId] as const;
}
