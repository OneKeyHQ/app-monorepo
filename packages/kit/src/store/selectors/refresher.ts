import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectRefresher = (state: IAppState) => state.refresher;

export const selectRefreshHistoryTs = createSelector(
  selectRefresher,
  (s) => s.refreshHistoryTs,
);
