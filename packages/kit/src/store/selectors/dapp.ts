import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectDapps = (state: IAppState) => state.dapp;

export const selectDappConnections = createSelector(
  selectDapps,
  (s) => s.connections,
);
