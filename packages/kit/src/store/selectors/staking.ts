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
