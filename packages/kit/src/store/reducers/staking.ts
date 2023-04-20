import { createSlice } from '@reduxjs/toolkit';

import type {
  KeleDashboardGlobal,
  KeleIncomeDTO,
  KeleMinerOverview,
  KeleOpHistoryDTO,
  KeleUnstakeOverviewDTO,
  KeleWithdrawOverviewDTO,
  StakingActivity,
} from '../../views/Staking/typing';
import type { PayloadAction } from '@reduxjs/toolkit';

export type StakingState = {
  hideUnstakeBulletin?: boolean;
  keleDashboardGlobal?: KeleDashboardGlobal;
  stakingActivities?: Record<
    string,
    Record<string, StakingActivity | undefined>
  >;
  keleUnstakeOverviews?: Record<string, Record<string, KeleUnstakeOverviewDTO>>;
  keleWithdrawOverviews?: Record<
    string,
    Record<string, KeleWithdrawOverviewDTO>
  >;
  keleMinerOverviews?: Record<string, Record<string, KeleMinerOverview>>;
  keleIncomes?: Record<string, Record<string, KeleIncomeDTO[]>>;
  kelePendingWithdraw?: Record<string, Record<string, number>>;
  keleOpHistory?: Record<string, Record<string, KeleOpHistoryDTO[]>>;
};

const initialState: StakingState = {};

export const stakingSlice = createSlice({
  name: 'staking',
  initialState,
  reducers: {
    setAccountStakingActivity(
      state,
      action: PayloadAction<{
        networkId: string;
        accountId: string;
        data?: StakingActivity;
      }>,
    ) {
      const { networkId, accountId, data } = action.payload;
      if (!state.stakingActivities) {
        state.stakingActivities = {};
      }
      if (!state.stakingActivities?.[accountId]) {
        state.stakingActivities[accountId] = {};
      }
      state.stakingActivities[accountId][networkId] = data;
    },
    setKeleDashboardGlobal(state, action: PayloadAction<KeleDashboardGlobal>) {
      state.keleDashboardGlobal = action.payload;
    },
    setKeleUnstakeOverview(
      state,
      action: PayloadAction<{
        networkId: string;
        accountId: string;
        unstakeOverview: KeleUnstakeOverviewDTO;
      }>,
    ) {
      if (!state.keleUnstakeOverviews) {
        state.keleUnstakeOverviews = {};
      }
      const { networkId, accountId, unstakeOverview } = action.payload;
      if (!state.keleUnstakeOverviews?.[accountId]) {
        state.keleUnstakeOverviews[accountId] = {};
      }
      state.keleUnstakeOverviews[accountId][networkId] = unstakeOverview;
    },
    setKeleWithdrawOverview(
      state,
      action: PayloadAction<{
        networkId: string;
        accountId: string;
        withdrawOverview: KeleWithdrawOverviewDTO;
      }>,
    ) {
      if (!state.keleWithdrawOverviews) {
        state.keleWithdrawOverviews = {};
      }
      const { networkId, accountId, withdrawOverview } = action.payload;
      if (!state.keleWithdrawOverviews[accountId]) {
        state.keleWithdrawOverviews[accountId] = {};
      }
      state.keleWithdrawOverviews[accountId][networkId] = withdrawOverview;
    },
    setKeleMinerOverviews(
      state,
      action: PayloadAction<{
        networkId: string;
        accountId: string;
        minerOverview: KeleMinerOverview;
      }>,
    ) {
      if (!state.keleMinerOverviews) {
        state.keleMinerOverviews = {};
      }
      const { networkId, accountId, minerOverview } = action.payload;
      if (!state.keleMinerOverviews[accountId]) {
        state.keleMinerOverviews[accountId] = {};
      }
      state.keleMinerOverviews[accountId][networkId] = minerOverview;
    },
    setKeleIncomes(
      state,
      action: PayloadAction<{
        networkId: string;
        accountId: string;
        incomes: KeleIncomeDTO[];
      }>,
    ) {
      if (!state.keleIncomes) {
        state.keleIncomes = {};
      }
      const { networkId, accountId, incomes } = action.payload;
      if (!state.keleIncomes[accountId]) {
        state.keleIncomes[accountId] = {};
      }
      state.keleIncomes[accountId][networkId] = incomes;
    },
    setKelePendingWithdraw(
      state,
      action: PayloadAction<{
        networkId: string;
        accountId: string;
        amount: number;
      }>,
    ) {
      const { networkId, accountId, amount } = action.payload;
      if (Number.isNaN(amount)) {
        return;
      }
      if (!state.kelePendingWithdraw) {
        state.kelePendingWithdraw = {};
      }
      if (!state.kelePendingWithdraw[accountId]) {
        state.kelePendingWithdraw[accountId] = {};
      }
      state.kelePendingWithdraw[accountId][networkId] = amount;
    },
    setHideUnstakeBulletin(state, action: PayloadAction<boolean>) {
      state.hideUnstakeBulletin = action.payload;
    },
    setKeleOpHistory(
      state,
      action: PayloadAction<{
        networkId: string;
        accountId: string;
        items: KeleOpHistoryDTO[];
      }>,
    ) {
      if (!state.keleOpHistory) {
        state.keleOpHistory = {};
      }
      const { networkId, accountId, items } = action.payload;
      if (!state.keleOpHistory[accountId]) {
        state.keleOpHistory[accountId] = {};
      }
      state.keleOpHistory[accountId][networkId] = items;
    },
  },
});

export const {
  setAccountStakingActivity,
  setKeleDashboardGlobal,
  setKeleUnstakeOverview,
  setKeleWithdrawOverview,
  setKeleMinerOverviews,
  setKeleIncomes,
  setKelePendingWithdraw,
  setHideUnstakeBulletin,
  setKeleOpHistory,
} = stakingSlice.actions;

export default stakingSlice.reducer;
