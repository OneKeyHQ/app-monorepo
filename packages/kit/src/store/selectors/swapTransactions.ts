import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectSwapTransactions = (state: IAppState) =>
  state.swapTransactions;

export const selectSwapTransactionsTokenList = createSelector(
  selectSwapTransactions,
  (s) => s.tokenList,
);

export const selectSwapTransactionsMaintain = createSelector(
  selectSwapTransactions,
  (s) => s.swapMaintain,
);

export const selectSwapTransactionsSlippage = createSelector(
  selectSwapTransactions,
  (s) => s.slippage,
);

export const selectSwapTransactionsCoingeckoIds = createSelector(
  selectSwapTransactions,
  (s) => s.coingeckoIds,
);

export const selectSwapTransactionsSwapChartMode = createSelector(
  selectSwapTransactions,
  (s) => s.swapChartMode,
);
