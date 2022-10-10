import { useEffect, useMemo } from 'react';
import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useIsFocused } from '@react-navigation/core';
import { useMarketSelectedCategory } from './useMarketCategory';
import { useIsVerticalLayout } from '@onekeyhq/components/src';
import { useAppSelector } from '../../../hooks';
import {
  MARKET_FAVORITES_CATEGORYID,
  MARKET_TAB_NAME,
} from '../../../store/reducers/market';

export const useListSort = () => {
  const listSort = useAppSelector((s) => s.market.listSort);
  return useMemo(() => listSort, [listSort]);
};

export const useMarketTopTabName = () => {
  const tabName = useAppSelector((s) => s.market.marktTobTapName);
  return useMemo(() => tabName, [tabName]);
};

export const useMarketList = ({
  pollingInterval = 60,
}: {
  pollingInterval?: number;
} = {}) => {
  const isFocused = useIsFocused();
  const selectedCategory = useMarketSelectedCategory();
  const isVerticalLlayout = useIsVerticalLayout();
  const listSort = useListSort();
  const marktTopTabName = useMarketTopTabName();
  // if favorites is empty don't fetch
  const checkFavoritesFetch = useMemo(() => {
    if (
      selectedCategory?.categoryId === MARKET_FAVORITES_CATEGORYID &&
      (!selectedCategory.coingeckoIds ||
        selectedCategory.coingeckoIds.length === 0)
    ) {
      return false;
    }
    return true;
  }, [selectedCategory]);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (
      isFocused &&
      selectedCategory &&
      marktTopTabName === MARKET_TAB_NAME &&
      checkFavoritesFetch
    ) {
      if (!listSort) {
        backgroundApiProxy.serviceMarket.fetchMarketList({
          categoryId: selectedCategory.categoryId,
          vsCurrency: 'usd',
          ids: selectedCategory.coingeckoIds?.join(','),
          sparkline: !isVerticalLlayout,
        });
      }
      timer = setInterval(() => {
        backgroundApiProxy.serviceMarket.fetchMarketList({
          categoryId: selectedCategory.categoryId,
          vsCurrency: 'usd',
          ids: selectedCategory.coingeckoIds?.join(','),
          sparkline: !isVerticalLlayout,
        });
      }, pollingInterval * 1000);
    }
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [
    selectedCategory,
    isFocused,
    isVerticalLlayout,
    pollingInterval,
    listSort,
    marktTopTabName,
    checkFavoritesFetch,
  ]);
  return {
    selectedCategory,
  };
};
