import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectTokens = (state: IAppState) => state.tokens;

export const selectTokenPriceMap = createSelector(
  selectTokens,
  (s) => s.tokenPriceMap,
);

export const selectAccountTokens = createSelector(
  selectTokens,
  (s) => s.accountTokens,
);

export const selectAccountTokensBalance = createSelector(
  selectTokens,
  (s) => s.accountTokensBalance,
);
