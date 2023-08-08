import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

const SwapTransactionsSelector = (state: IAppState) => state.swapTransactions;

export const selectSwapTransactionsTokenList = createSelector(
  SwapTransactionsSelector,
  (s) => s.tokenList,
);

export const selectSwapTransactionsMaintain = createSelector(
  SwapTransactionsSelector,
  (s) => s.swapMaintain,
);

export const selectSwapTransactionsSlippage = createSelector(
  SwapTransactionsSelector,
  (s) => s.slippage,
);

export const selectSwapTransactionsCoingeckoIds = createSelector(
  SwapTransactionsSelector,
  (s) => s.coingeckoIds,
);

export const selectSwapTransactionsSwapChartMode = createSelector(
  SwapTransactionsSelector,
  (s) => s.swapChartMode,
);

export const selectSwapTransactionsSwapFeePresetIndex = createSelector(
  SwapTransactionsSelector,
  (s) => s.swapFeePresetIndex,
);

export const selectSwapTransactionsLimitOrderDetails = createSelector(
  SwapTransactionsSelector,
  (s) => s.limitOrderDetails,
);

export const selectSwapTransactionsRecommendedSlippage = createSelector(
  SwapTransactionsSelector,
  (s) => s.recommendedSlippage,
);

export const selectSwapTransactions = createSelector(
  SwapTransactionsSelector,
  (s) => s.transactions,
);

export const selectSwapTransactionsLimitOrderMaintain = createSelector(
  SwapTransactionsSelector,
  (s) => s.limitOrderMaintain,
);
