import { useCallback, useEffect, useMemo } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { TabActions } from '@react-navigation/native';

import { useIsVerticalLayout } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import { getAppNavigation } from '../../../hooks/useAppNavigation';
import { TabRoutes } from '../../../routes/routesEnum';
import { MARKET_FAVORITES_CATEGORYID } from '../../../store/reducers/market';
import { isAtAppRootTab } from '../../../utils/routeUtils';

import { useMarketSelectedCategory } from './useMarketCategory';
import { useMarketMidLayout } from './useMarketLayout';

import type { MarketTopTabName } from '../../../store/reducers/market';

export const useListSort = () => {
  const listSort = useAppSelector((s) => s.market.listSort);
  return useMemo(() => listSort, [listSort]);
};

export const useMobileMarketTopTabName = () =>
  useAppSelector((s) => s.market.marketTopTabName) || TabRoutes.Swap;

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
  const isVerticalLayout = useIsVerticalLayout();
  const isMidLayout = useMarketMidLayout();
  const listSort = useListSort();

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
    if (isFocused && selectedCategory?.categoryId && checkFavoritesFetch) {
      if (!listSort) {
        backgroundApiProxy.serviceMarket.fetchMarketListDebounced({
          categoryId: selectedCategory.categoryId,
          ids: coingeckoIds,
          sparkline: !isVerticalLayout && !isMidLayout,
        });
      }
      timer = setInterval(() => {
        if (isAtAppRootTab(TabRoutes.Market)) {
          backgroundApiProxy.serviceMarket.fetchMarketListDebounced({
            categoryId: selectedCategory.categoryId,
            ids: coingeckoIds,
            sparkline: !isVerticalLayout && !isMidLayout,
          });
        }
      }, pollingInterval * 1000);
    }
    return () => {
      clearInterval(timer);
    };
  }, [
    selectedCategory?.categoryId,
    isFocused,
    isVerticalLayout,
    pollingInterval,
    listSort,
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
        sparkline: !isVerticalLayout && !isMidLayout,
      });
    }
  }, [isMidLayout, isVerticalLayout, selectedCategory, coingeckoIds]);

  return {
    selectedCategory,
    onRefreshingMarketList,
  };
};

export const marketSwapTabRoutes: { key: MarketTopTabName }[] = [
  { key: TabRoutes.Swap },
  { key: TabRoutes.Market },
];
export const setMarketSwapTabName = (tabName: MarketTopTabName) => {
  backgroundApiProxy.serviceMarket.switchMarketTopTab(tabName);
  getAppNavigation().dispatch(TabActions.jumpTo(tabName));
};
