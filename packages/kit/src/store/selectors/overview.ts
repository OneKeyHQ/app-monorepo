import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectOverview = (state: IAppState) => state.overview;

export const selectAllNetworksAccountsMap = createSelector(
  selectOverview,
  (s) => s.allNetworksAccountsMap,
);
