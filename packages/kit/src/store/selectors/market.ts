import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectMarket = (state: IAppState) => state.market;

export const selectSelectedCategoryId = createSelector(
  selectMarket,
  (s) => s.selectedCategoryId,
);

export const selectMarketCategorys = createSelector(
  selectMarket,
  (s) => s.categorys,
);

export const selectMarketDetails = createSelector(
  selectMarket,
  (s) => s.details,
);

export const selectMarketListSort = createSelector(
  selectMarket,
  (s) => s.listSort,
);

export const selectMarketTopTabName = createSelector(
  selectMarket,
  (s) => s.marketTopTabName,
);

export const selectMarketSearchHistory = createSelector(
  selectMarket,
  (s) => s.searchHistory,
);

export const selectMarketSearchKeyword = createSelector(
  selectMarket,
  (s) => s.searchKeyword,
);

export const selectMarketSearchTokens = createSelector(
  selectMarket,
  (s) => s.searchTokens,
);

export const selectMarketCharts = createSelector(selectMarket, (s) => s.charts);

export const selectMarketTokens = createSelector(
  selectMarket,
  (s) => s.marketTokens,
);

export const selectMarketSearchTabCategoryId = createSelector(
  selectMarket,
  (s) => s.searchTabCategoryId,
);
