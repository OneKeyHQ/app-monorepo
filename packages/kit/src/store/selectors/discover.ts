import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectDiscover = (state: IAppState) => state.discover;

export const selectDiscoverBookmarks = createSelector(
  selectDiscover,
  (s) => s.bookmarks,
);

export const selectDiscoverHome = createSelector(selectDiscover, (s) => s.home);

export const selectShowBookmark = createSelector(
  selectDiscover,
  (s) => s.showBookmark,
);

export const selectDiscoverNetworkPrices = createSelector(
  selectDiscover,
  (s) => s.networkPrices,
);

export const selectUserBrowserHistories = createSelector(
  selectDiscover,
  (s) => s.userBrowserHistories,
);

export const selectFavoritesMigrated = createSelector(
  selectDiscover,
  (s) => s.favoritesMigrated,
);

export const selectDappFavorites = createSelector(
  selectDiscover,
  (s) => s.dappFavorites,
);
