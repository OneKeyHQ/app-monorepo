import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectFiatMoney = (state: IAppState) => state.fiatMoney;

export const selectFiatMap = createSelector(selectFiatMoney, (s) => s.map);

export const selectSymbolList = createSelector(
  selectFiatMoney,
  (s) => s.symbolList,
);
