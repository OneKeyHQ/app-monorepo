import { useCallback, useEffect, useMemo } from 'react';

import { debounce } from 'lodash';

import {
  useIsVerticalLayout,
  useThemeValue,
  useUserDevice,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';

import { useMarketSearchCategoryList } from './useMarketCategory';

const MARKET_SEARCH_CHANGE_DELAY = 500;

export const useMarketSearchHistory = () => {
  const reduxHistory = useAppSelector((s) => s.market.searchHistory);
  useEffect(() => {
    if (!reduxHistory) {
      backgroundApiProxy.serviceMarket.syncSearchHistory();
    }
  }, [reduxHistory]);
  return useMemo(() => reduxHistory, [reduxHistory]);
};

export const useMarketSearchSelectedCategory = () => {
  const searchTabCategoryId = useAppSelector(
    (s) => s.market.searchTabCategoryId,
  );
  const searchCategory = useMarketSearchCategoryList();

  useEffect(() => {
    if (!searchTabCategoryId) {
      if (searchCategory.length > 0) {
        backgroundApiProxy.serviceMarket.setMarketSearchTab(
          searchCategory[0].categoryId,
        );
      }
    }
  }, [searchCategory, searchTabCategoryId]);

  useEffect(() => {
    if (searchTabCategoryId) {
      backgroundApiProxy.serviceMarket.fetchMarketListDebounced({
        categoryId: searchTabCategoryId,
        sparkline: false,
      });
    }
  }, [searchTabCategoryId]);
  return useMemo(() => searchTabCategoryId, [searchTabCategoryId]);
};

export const useMarketSearchContainerStyle = () => {
  const isVertical = useIsVerticalLayout();
  const { screenHeight } = useUserDevice();
  const [desktopBgColor, verticalBgColor] = useThemeValue([
    'background-default',
    'background-default',
  ]);
  const w = useMemo(() => (isVertical ? 'full' : 360), [isVertical]);
  const h = useMemo(
    () => (isVertical ? screenHeight * 0.9 : 450),
    [isVertical, screenHeight],
  );
  const p = useMemo(() => (isVertical ? 4 : 1), [isVertical]);
  const bgColor = useMemo(
    () => (isVertical ? verticalBgColor : desktopBgColor),
    [isVertical, verticalBgColor, desktopBgColor],
  );
  return { w, h, p, bgColor };
};

export const useMarketSearchTokens = () => {
  const searchKeyword = useAppSelector((s) => s.market.searchKeyword);
  const cacheTokens = useAppSelector((s) => s.market.searchTokens);
  const searchTokens = useMemo(() => {
    if (searchKeyword && searchKeyword.length > 0) {
      return cacheTokens[searchKeyword];
    }
  }, [cacheTokens, searchKeyword]);

  useEffect(() => {
    if (searchKeyword && searchKeyword.length > 0)
      backgroundApiProxy.serviceMarket.fetchMarketSearchTokens({
        searchKeyword,
      });
  }, [searchKeyword]);
  return { searchTokens, searchKeyword };
};

export const useMarketSearchTokenChange = () => {
  const searchOnChange = useCallback((keyword: string) => {
    const query = keyword.trim();
    backgroundApiProxy.serviceMarket.updateMarketSearchKeyword({
      searchKeyword: query,
    });
  }, []);
  return useMemo(
    () => debounce(searchOnChange, MARKET_SEARCH_CHANGE_DELAY),
    [searchOnChange],
  );
};
