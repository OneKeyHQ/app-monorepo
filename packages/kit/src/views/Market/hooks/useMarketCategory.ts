import { useMemo } from 'react';

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
  const categorys = useAppSelector((s) => s.market.categorys);
  return useMemo(() => {
    if (categorys && Object.values(categorys).length > 0) {
      return Object.values(categorys).filter(
        (c) => c.type === MarketCategoryType.MRKET_CATEGORY_TYPE_TAB,
      );
    }
    backgroundApiProxy.serviceMarket.fetchMarketCategorys();
    return [];
  }, [categorys]);
};

export const useMarketFavoriteRecommentedList = () => {
  const categorys = useAppSelector((s) => s.market.categorys);
  const favoritesCategory = categorys[MARKET_FAVORITES_CATEGORYID];
  return useMemo(
    () =>
      favoritesCategory && favoritesCategory.recommendedTokens
        ? favoritesCategory.recommendedTokens
        : [],
    [favoritesCategory],
  );
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
