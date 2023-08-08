import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectRefresher = (state: IAppState) => state.refresher;

export const selectRefreshHistoryTs = createSelector(
  selectRefresher,
  (s) => s.refreshHistoryTs,
);

export const selectRefreshAccountSelectorTs = createSelector(
  selectRefresher,
  (s) => s.refreshAccountSelectorTs,
);

export const selectRefreshConnectedSitesTs = createSelector(
  selectRefresher,
  (s) => s.refreshConnectedSitesTs,
);

export const selectCloseDappConnectionPreloadingTs = createSelector(
  selectRefresher,
  (s) => s.closeDappConnectionPreloadingTs,
);

export const selectBackgroundShowToastOptions = createSelector(
  selectRefresher,
  (s) => s.backgroundShowToastOptions,
);

export const selectBackgroundShowToastTs = createSelector(
  selectRefresher,
  (s) => s.backgroundShowToastTs,
);
