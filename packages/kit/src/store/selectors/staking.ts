import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectStaking = (state: IAppState) => state.staking;

export const selectKeleMinerOverviews = createSelector(
  selectStaking,
  (s) => s.keleMinerOverviews,
);

export const selectEthStakingApr = createSelector(
  selectStaking,
  (s) => s.ethStakingApr,
);

export const selectLidoOverview = createSelector(
  selectStaking,
  (s) => s.lidoOverview,
);

export const selectStakingTransactions = createSelector(
  selectStaking,
  (s) => s.transactions,
);

export const selectKeleTransactions = createSelector(
  selectStaking,
  (s) => s.keleTransactions,
);

export const selectStakingStEthRate = createSelector(
  selectStaking,
  (s) => s.stEthRate,
);

export const selecKeleUnstakeOverviews = createSelector(
  selectStaking,
  (s) => s.keleUnstakeOverviews,
);

export const selecKeleWithdrawOverviews = createSelector(
  selectStaking,
  (s) => s.keleWithdrawOverviews,
);

export const selecKeleNetworkDashboardGlobal = createSelector(
  selectStaking,
  (s) => s.keleNetworkDashboardGlobal,
);

export const selecKeleIncomes = createSelector(
  selectStaking,
  (s) => s.keleIncomes,
);

export const selecKeleOpHistory = createSelector(
  selectStaking,
  (s) => s.keleOpHistory,
);

export const selecKelePendingWithdraw = createSelector(
  selectStaking,
  (s) => s.kelePendingWithdraw,
);
