import { useCallback, useEffect, useMemo, useState } from 'react';

import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks/useMarketBasicConfig';
import { useMarketSelectedTabAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IMarketCategoryToSelectResult } from '@onekeyhq/shared/src/logger/scopes/market/scenes/navigation';

import { MARKET_PERPS_DEFAULT_CATEGORY_ID } from '../constants';

function useSyncedMarketPerpsCategory() {
  const {
    perpsCategories: rawPerpsCategories,
    isLoading: isMarketBasicConfigLoading,
  } = useMarketBasicConfig();
  const [
    { selectedPerpsCategory, perpsCategoryToSelect },
    setMarketSelectedTab,
  ] = useMarketSelectedTabAtom();

  const perpsCategories = useMemo(
    () =>
      rawPerpsCategories.map((c) => ({
        tabId: c.categoryId,
        name: c.name,
      })),
    [rawPerpsCategories],
  );

  const fallbackCategoryId = useMemo(() => {
    const hasSelectedCategory =
      selectedPerpsCategory &&
      (perpsCategories.length === 0 ||
        perpsCategories.some(
          (category) => category.tabId === selectedPerpsCategory,
        ));

    if (hasSelectedCategory) {
      return selectedPerpsCategory;
    }

    return perpsCategories[0]?.tabId ?? MARKET_PERPS_DEFAULT_CATEGORY_ID;
  }, [perpsCategories, selectedPerpsCategory]);

  const [selectedCategoryId, setSelectedCategoryId] =
    useState(fallbackCategoryId);

  useEffect(() => {
    if (!perpsCategoryToSelect) {
      return;
    }

    const logResult = (result: IMarketCategoryToSelectResult) => {
      defaultLogger.market.navigation.marketHomeApplyPerpsCategory({
        categoryId: perpsCategoryToSelect,
        result,
        categoryCount: perpsCategories.length,
      });
    };
    const hasTargetCategory = perpsCategories.some(
      (category) => category.tabId === perpsCategoryToSelect,
    );

    if (!hasTargetCategory) {
      if (isMarketBasicConfigLoading !== false) {
        logResult('waitingForConfig');
        return;
      }

      logResult('unknownCategory');
      setMarketSelectedTab((prev) => ({
        ...prev,
        selectedPerpsCategory:
          prev.selectedPerpsCategory === perpsCategoryToSelect
            ? undefined
            : prev.selectedPerpsCategory,
        perpsCategoryToSelect: undefined,
      }));
      return;
    }

    logResult('applied');
    if (selectedCategoryId !== perpsCategoryToSelect) {
      setSelectedCategoryId(perpsCategoryToSelect);
    }
    setMarketSelectedTab((prev) => ({
      ...prev,
      selectedPerpsCategory: perpsCategoryToSelect,
      perpsCategoryToSelect: undefined,
    }));
  }, [
    isMarketBasicConfigLoading,
    perpsCategories,
    perpsCategoryToSelect,
    selectedCategoryId,
    setMarketSelectedTab,
  ]);

  useEffect(() => {
    if (perpsCategoryToSelect) {
      return;
    }

    const shouldSyncSelectedCategory =
      !selectedCategoryId ||
      (perpsCategories.length > 0 &&
        !perpsCategories.some(
          (category) => category.tabId === selectedCategoryId,
        ));

    if (shouldSyncSelectedCategory && fallbackCategoryId) {
      setSelectedCategoryId(fallbackCategoryId);
      setMarketSelectedTab((prev) => ({
        ...prev,
        selectedPerpsCategory: fallbackCategoryId,
      }));
    }
  }, [
    fallbackCategoryId,
    perpsCategories,
    perpsCategoryToSelect,
    selectedCategoryId,
    setMarketSelectedTab,
  ]);

  const handleSelectCategory = useCallback(
    (categoryId: string) => {
      setSelectedCategoryId(categoryId);
      setMarketSelectedTab((prev) => ({
        ...prev,
        selectedPerpsCategory: categoryId,
        perpsCategoryToSelect: undefined,
      }));
    },
    [setMarketSelectedTab],
  );

  return {
    perpsCategories,
    selectedCategoryId,
    handleSelectCategory,
  };
}

export { useSyncedMarketPerpsCategory };
