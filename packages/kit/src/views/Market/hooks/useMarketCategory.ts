import { useEffect, useMemo, useState } from 'react';
import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import { MarketCategory } from '../../../store/reducers/market';

export const useMarketCurrentCategory = () => {
  const currentCategory = useAppSelector((s) => s.market.currentCategory);
  return useMemo(() => currentCategory, [currentCategory]);
};

export const useMarketCategoryList = () => {
  const categorys = useAppSelector((s) => s.market.categorys);
  return useMemo(() => {
    if (categorys && categorys.length > 0) {
      return categorys.filter((c) => c.type === 'tab');
    }
    backgroundApiProxy.serviceMarket.fetchMarketCategorys();
    return [];
  }, [categorys]);
};

export const useMarketSearchCategoryList = () => {
  const categorys = useAppSelector((s) => s.market.categorys);
  return useMemo(() => {
    if (categorys && categorys.length > 0) {
      return categorys.filter((c) => c.type === 'search');
    }
    return [];
  }, [categorys]);
};

export const useMarketCategoryLoading = () => {
  const currentCategory = useMarketCurrentCategory();
  const tokenMap = useAppSelector((s) => s.market.categoryTokenMap);
  return useMemo(() => {
    if (!currentCategory || !tokenMap[currentCategory.categoryId]) {
      return true;
    }
    return false;
  }, [tokenMap, currentCategory]);
};
