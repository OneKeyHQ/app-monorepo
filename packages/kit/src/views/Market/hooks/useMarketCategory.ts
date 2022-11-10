import { useEffect, useMemo } from 'react';

import { useIsFocused } from '@react-navigation/core';

import { useIsVerticalLayout } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import {
  MARKET_FAVORITES_CATEGORYID,
  MarketCategoryType,
} from '../../../store/reducers/market';

export const useMarketSelectedCategory = () => {
  const selectedCategoryId = useAppSelector((s) => s.market.selectedCategoryId);
  const categorys = useAppSelector((s) => s.market.categorys);
  return useMemo(
    () => (selectedCategoryId ? categorys[selectedCategoryId] : null),
    [categorys, selectedCategoryId],
  );
};

export const useMarketSelectedCategoryId = () => {
  const selectedCategoryId = useAppSelector((s) => s.market.selectedCategoryId);
  return useMemo(() => selectedCategoryId, [selectedCategoryId]);
};

export const useMarketCategoryList = () => {
  const isFocused = useIsFocused();
  const categorys = useAppSelector((s) => s.market.categorys);
  useEffect(() => {
    if (isFocused) {
      backgroundApiProxy.serviceMarket.fetchMarketCategorys();
    }
  }, [isFocused]);
  return useMemo(() => {
    if (categorys && Object.values(categorys).length > 0) {
      return Object.values(categorys).filter(
        (c) => c.type === MarketCategoryType.MRKET_CATEGORY_TYPE_TAB,
      );
    }
    return [];
  }, [categorys]);
};

const RECOMMENDED_VIEW_COUNT_VERTIVAL = 8;
const RECOMMENDED_VIEW_COUNT = 12;

export const useMarketFavoriteRecommentedList = () => {
  const categorys = useAppSelector((s) => s.market.categorys);
  const isVertival = useIsVerticalLayout();
  const favoritesCategory = categorys[MARKET_FAVORITES_CATEGORYID];
  return useMemo(() => {
    if (favoritesCategory && favoritesCategory.recommendedTokens?.length) {
      if (
        favoritesCategory.recommendedTokens?.length > RECOMMENDED_VIEW_COUNT
      ) {
        return [...favoritesCategory.recommendedTokens].slice(
          0,
          isVertival ? RECOMMENDED_VIEW_COUNT_VERTIVAL : RECOMMENDED_VIEW_COUNT,
        );
      }
      if (
        favoritesCategory.recommendedTokens?.length >
        RECOMMENDED_VIEW_COUNT_VERTIVAL
      ) {
        return isVertival
          ? [...favoritesCategory.recommendedTokens].slice(
              0,
              RECOMMENDED_VIEW_COUNT_VERTIVAL,
            )
          : [...favoritesCategory.recommendedTokens];
      }
      return [...favoritesCategory.recommendedTokens];
    }
    return [];
  }, [favoritesCategory, isVertival]);
};

export const useMarketFavoriteCategoryTokenIds = () => {
  const categorys = useAppSelector((s) => s.market.categorys);
  const favoritesCategory = categorys[MARKET_FAVORITES_CATEGORYID];
  return useMemo(
    () =>
      favoritesCategory && favoritesCategory.coingeckoIds
        ? favoritesCategory.coingeckoIds
        : [],
    [favoritesCategory],
  );
};

export const useMarketSearchCategoryList = () => {
  const categorys = useAppSelector((s) => s.market.categorys);
  return useMemo(() => {
    if (categorys && Object.values(categorys).length > 0) {
      return Object.values(categorys).filter(
        (c) => c.type === MarketCategoryType.MRKET_CATEGORY_TYPE_SEARCH,
      );
    }
    return [];
  }, [categorys]);
};
