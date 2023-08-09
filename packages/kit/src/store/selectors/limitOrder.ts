import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectLimitOrder = (state: IAppState) => state.limitOrder;

export const selectLimitOrderActiveAccount = createSelector(
  selectLimitOrder,
  (s) => s.activeAccount,
);

export const selectLimitOrderTokenIn = createSelector(
  selectLimitOrder,
  (s) => s.tokenIn,
);

export const selectLimitOrderTokenOut = createSelector(
  selectLimitOrder,
  (s) => s.tokenOut,
);

export const selectLimitOrderTypedValue = createSelector(
  selectLimitOrder,
  (s) => s.typedValue,
);

export const selectLimitOrderInstantRate = createSelector(
  selectLimitOrder,
  (s) => s.instantRate,
);

export const selectLimitOrderTypedPrice = createSelector(
  selectLimitOrder,
  (s) => s.typedPrice,
);

export const selectLimitOrderMktRate = createSelector(
  selectLimitOrder,
  (s) => s.mktRate,
);

export const selectLimitOrderLoading = createSelector(
  selectLimitOrder,
  (s) => s.loading,
);

export const selectLimitOrderExpireIn = createSelector(
  selectLimitOrder,
  (s) => s.expireIn,
);
