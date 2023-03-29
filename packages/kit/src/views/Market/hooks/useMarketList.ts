import { useCallback, useEffect, useMemo } from 'react';

import { useIsFocused } from '@react-navigation/core';

import { useIsVerticalLayout } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import { TabRoutes } from '../../../routes/routesEnum';
import { MARKET_FAVORITES_CATEGORYID } from '../../../store/reducers/market';

import { useMarketSelectedCategory } from './useMarketCategory';
import { useMarketMidLayout } from './useMarketLayout';

export const useListSort = () => {
  const listSort = useAppSelector((s) => s.market.listSort);
  return useMemo(() => listSort, [listSort]);
};

export const useMarketTopTabName = () => {
  const tabName = useAppSelector((s) => s.market.marktTobTapName);
  return useMemo(() => tabName, [tabName]);
};

const useMarketCategoryCoingeckoIds = () => {
  const selectedCategory = useMarketSelectedCategory();
  return useMemo(() => {
    if (selectedCategory?.categoryId === MARKET_FAVORITES_CATEGORYID) {
      return selectedCategory.coingeckoIds?.join(',');
    }
  }, [selectedCategory?.categoryId, selectedCategory?.coingeckoIds]);
};

export const useMarketList = ({
  pollingInterval = 60,
}: {
  pollingInterval?: number;
} = {}) => {
  const isFocused = useIsFocused();
  const selectedCategory = useMarketSelectedCategory();
  const isVerticalLlayout = useIsVerticalLayout();
  const isMidLayout = useMarketMidLayout();
  const listSort = useListSort();
  const marktTopTabName = useMarketTopTabName();

  // if favorites is empty don't fetch
  const checkFavoritesFetch = useMemo(() => {
    if (
      selectedCategory?.categoryId === MARKET_FAVORITES_CATEGORYID &&
      !selectedCategory.coingeckoIds?.length
    ) {
      return false;
    }
    return true;
  }, [selectedCategory]);
  const coingeckoIds = useMarketCategoryCoingeckoIds();
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (
      isFocused &&
      selectedCategory?.categoryId &&
      marktTopTabName === TabRoutes.Market &&
      checkFavoritesFetch
    ) {
      if (!listSort) {
        backgroundApiProxy.serviceMarket.fetchMarketListDebounced({
          categoryId: selectedCategory.categoryId,
          ids: coingeckoIds,
          sparkline: !isVerticalLlayout && !isMidLayout,
        });
      }
      timer = setInterval(() => {
        backgroundApiProxy.serviceMarket.fetchMarketListDebounced({
          categoryId: selectedCategory.categoryId,
          ids: coingeckoIds,
          sparkline: !isVerticalLlayout && !isMidLayout,
        });
      }, pollingInterval * 1000);
    }
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [
    selectedCategory?.categoryId,
    isFocused,
    isVerticalLlayout,
    pollingInterval,
    listSort,
    marktTopTabName,
    checkFavoritesFetch,
    isMidLayout,
    coingeckoIds,
  ]);
  const onRefreshingMarketList = useCallback(async () => {
    await backgroundApiProxy.serviceMarket.fetchMarketCategorys();
    if (selectedCategory) {
      await backgroundApiProxy.serviceMarket.fetchMarketListDebounced({
        categoryId: selectedCategory.categoryId,
        ids: coingeckoIds,
        sparkline: !isVerticalLlayout && !isMidLayout,
      });
    }
  }, [isMidLayout, isVerticalLlayout, selectedCategory, coingeckoIds]);

  return {
    selectedCategory,
    onRefreshingMarketList,
  };
};
