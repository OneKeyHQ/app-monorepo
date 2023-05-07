import { useCallback, useEffect, useMemo } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { CommonActions } from '@react-navigation/native';

import { useIsVerticalLayout } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import { TabRoutes } from '../../../routes/routesEnum';
import { buildAppRootTabName } from '../../../routes/routesUtils';
import { MARKET_FAVORITES_CATEGORYID } from '../../../store/reducers/market';
import {
  getRootRoute,
  getRootTabRoute,
  getRootTabRouteState,
} from '../../../utils/routeUtils';

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
        backgroundApiProxy.serviceMarket.fetchMarketListDebounced({
          categoryId: selectedCategory.categoryId,
          ids: coingeckoIds,
          sparkline: !isVerticalLayout && !isMidLayout,
        });
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
export const setMarketSwapTabName = (
  tabName: MarketTopTabName,
  forceNavigate?: boolean,
) => {
  // if (platformEnv.isNative && !forceNavigate) {
  //   return backgroundApiProxy.serviceMarket.switchMarketTopTab(tabName);
  // }
  backgroundApiProxy.serviceMarket.switchMarketTopTab(tabName);
  if (forceNavigate) {
    // hack: force write new tab name to navigation state
    const rootRoute = getRootRoute();
    const tabRoute = getRootTabRoute();
    const tabRouteState = getRootTabRouteState();
    // console.log(1, JSON.stringify(getRootRoute(), null));
    if (tabRouteState) {
      const targetRouteIndex = tabRouteState.routes?.findIndex(
        (r) => r.name === tabName,
      );
      const targetRoute = tabRouteState.routes?.[targetRouteIndex];
      const targetKey = targetRoute?.key;
      const paramsScreenName = buildAppRootTabName(tabName);
      // @ts-expect-error
      tabRouteState.index = targetRouteIndex;
      // @ts-expect-error
      tabRouteState.history.at(-1).key = targetKey;
      // @ts-expect-error
      tabRoute.params.screen = tabName;
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      tabRoute.params.params.screen = paramsScreenName;

      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      rootRoute.params.params.screen = tabName;
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      rootRoute.params.params.params.screen = paramsScreenName;

      // dispatch to update the modified navigate state
      global?.$navigationRef?.current?.dispatch(CommonActions.setParams({}));
    }
  }

  // if (tabName === TabRoutes.Swap) {
  //   navigationShortcuts.navigateToSwap();
  // } else if (tabName === TabRoutes.Market) {
  //   navigationShortcuts.navigateToMarket();
  // }
};
