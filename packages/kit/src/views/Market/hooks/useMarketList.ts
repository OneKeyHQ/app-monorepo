import { useEffect, useMemo } from 'react';
import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useIsFocused } from '@react-navigation/core';
import {
  useMarketSelectedCategory,
} from './useMarketCategory';
import { useIsVerticalLayout } from '@onekeyhq/components/src';
import { useAppSelector } from '../../../hooks';

export const useListSort = () => {
  const listSort = useAppSelector((s) => s.market.listSort);
  return useMemo(() => listSort, [listSort]);
};

export const useMarketList = ({
  pollingInterval = 60,
}: {
  pollingInterval?: number;
} = {}) => {
  const isFocused = useIsFocused();
  const selectedCategory = useMarketSelectedCategory();
  const isVerticalLlayout = useIsVerticalLayout();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (isFocused && selectedCategory) {
      backgroundApiProxy.serviceMarket.fetchMarketList({
        categoryId: selectedCategory.categoryId,
        vsCurrency: 'usd',
        ids: selectedCategory.coingeckoIds?.join(','),
        sparkline: !isVerticalLlayout,
      });
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
  }, [selectedCategory, isFocused, isVerticalLlayout, pollingInterval]);
  return {
    selectedCategory,
  };
};
