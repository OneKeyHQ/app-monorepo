import { useEffect, useMemo } from 'react';
import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useIsFocused } from '@react-navigation/core';
import {
  useMarketCategoryLoading,
  useMarketCurrentCategory,
} from './useMarketCategory';
import { useIsVerticalLayout } from '@onekeyhq/components/src';
import { useAppSelector } from '../../../hooks';

export const useManageMarket = ({
  pollingInterval = 60,
}: {
  pollingInterval?: number;
}) => {
  const isFocused = useIsFocused();
  const currentCategory = useMarketCurrentCategory();
  const isVerticalLlayout = useIsVerticalLayout();
  const markeListLoad = useMarketCategoryLoading();
  const marketCategoryTokenMap = useAppSelector(
    (s) => s.market.categoryTokenMap,
  );
  const currentMarketlist = useMemo(() => {
    if (currentCategory) {
      return marketCategoryTokenMap[currentCategory.categoryId];
    }
  }, [currentCategory, marketCategoryTokenMap]);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (isFocused && currentCategory) {
      backgroundApiProxy.serviceMarket.fetchMarketList({
        categoryId: currentCategory.categoryId,
        vsCurrency: 'usd',
        ids: currentCategory.coingeckoIds?.join(','),
        sparkline: !isVerticalLlayout,
      });
      timer = setInterval(() => {
        backgroundApiProxy.serviceMarket.fetchMarketList({
          categoryId: currentCategory.categoryId,
          vsCurrency: 'usd',
          ids: currentCategory.coingeckoIds?.join(','),
          sparkline: !isVerticalLlayout,
        });
      }, pollingInterval * 1000);
    }
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [currentCategory, isFocused, isVerticalLlayout, pollingInterval]);
  return {
    isListLoading: markeListLoad,
    currentCategory,
    currentMarketlist,
  };
};
