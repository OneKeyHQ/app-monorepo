import { createSlice } from '@reduxjs/toolkit';

import type {
  EthStakingApr,
  KeleDashboardGlobal,
  KeleIncomeDTO,
  KeleMinerOverview,
  KeleOpHistoryDTO,
  KeleTransactionDetails,
  KeleUnstakeOverviewDTO,
  KeleWithdrawOverviewDTO,
  LidoMaticOverview,
  LidoOverview,
  TransactionDetails,
} from '../../views/Staking/typing';
import type { PayloadAction } from '@reduxjs/toolkit';

export type StakingState = {
  // hideUnstakeBulletin?: boolean;
  keleNetworkDashboardGlobal?: Record<string, KeleDashboardGlobal>;
  keleDashboardGlobal?: KeleDashboardGlobal;
  // stakingActivities?: Record<
  //   string,
  //   Record<string, StakingActivity | undefined>
  // >;
  keleUnstakeOverviews?: Record<string, Record<string, KeleUnstakeOverviewDTO>>;
  keleWithdrawOverviews?: Record<
    string,
    Record<string, KeleWithdrawOverviewDTO>
  >;
  keleMinerOverviews?: Record<string, Record<string, KeleMinerOverview>>;
  keleIncomes?: Record<string, Record<string, KeleIncomeDTO[]>>;
  kelePendingWithdraw?: Record<string, Record<string, number>>;
  keleOpHistory?: Record<string, Record<string, KeleOpHistoryDTO[]>>;
  ethStakingApr?: EthStakingApr;
  lidoOverview?: Record<string, Record<string, LidoOverview | undefined>>;
  lidoMaticOverview?: Record<
    string,
    Record<string, LidoMaticOverview | undefined>
  >;
  transactions?: Record<string, Record<string, TransactionDetails[]>>;
  keleTransactions?: Record<string, Record<string, KeleTransactionDetails[]>>;
  stEthRate?: Record<string, string>;
};

const initialState: StakingState = {};

export const stakingSlice = createSlice({
  name: 'staking',
  initialState,
  reducers: {
    setKeleNetworkDashboardGlobal(
      state,
      action: PayloadAction<{
        networkId: string;
        dashboard: KeleDashboardGlobal;
      }>,
    ) {
      const { networkId, dashboard } = action.payload;
      if (!state.keleNetworkDashboardGlobal) {
        state.keleNetworkDashboardGlobal = {};
      }
      state.keleNetworkDashboardGlobal[networkId] = dashboard;
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
    // setHideUnstakeBulletin(state, action: PayloadAction<boolean>) {
    //   state.hideUnstakeBulletin = action.payload;
    // },
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
    setETHStakingApr(state, action: PayloadAction<EthStakingApr>) {
      state.ethStakingApr = action.payload;
    },
    setLidoOverview(
      state,
      action: PayloadAction<{
        networkId: string;
        accountId: string;
        overview: LidoOverview;
      }>,
    ) {
      if (!state.lidoOverview) {
        state.lidoOverview = {};
      }
      const { networkId, accountId, overview } = action.payload;
      if (!state.lidoOverview[accountId]) {
        state.lidoOverview[accountId] = {};
      }
      state.lidoOverview[accountId][networkId] = overview;
    },
    setLidoMaticOverview(
      state,
      action: PayloadAction<{
        networkId: string;
        accountId: string;
        overview: LidoMaticOverview;
      }>,
    ) {
      if (!state.lidoMaticOverview) {
        state.lidoMaticOverview = {};
      }
      const { networkId, accountId, overview } = action.payload;
      if (!state.lidoMaticOverview[accountId]) {
        state.lidoMaticOverview[accountId] = {};
      }
      state.lidoMaticOverview[accountId][networkId] = overview;
    },
    addTransaction(
      state,
      action: PayloadAction<{
        accountId: string;
        networkId: string;
        transaction: TransactionDetails;
      }>,
    ) {
      const { accountId, networkId, transaction } = action.payload;
      if (!state.transactions) {
        state.transactions = {};
      }
      if (!state.transactions[accountId]) {
        state.transactions[accountId] = {};
      }
      const oldTransactions = state.transactions[accountId][networkId] ?? [];
      const newTransactions = [transaction, ...oldTransactions];
      if (newTransactions.length > 30) {
        newTransactions.length = 30;
      }
      state.transactions[accountId][networkId] = newTransactions;
    },
    archiveTransaction(
      state,
      action: PayloadAction<{
        accountId: string;
        networkId: string;
        txs: string[];
      }>,
    ) {
      if (!state.transactions) {
        return;
      }
      const { accountId, networkId, txs } = action.payload;
      const transactions = state.transactions[accountId]?.[networkId];
      transactions.forEach((tx) => {
        if (txs.includes(tx.hash)) {
          tx.archive = true;
        }
      });
    },
    addKeleTransaction(
      state,
      action: PayloadAction<{
        accountId: string;
        networkId: string;
        transaction: KeleTransactionDetails;
      }>,
    ) {
      const { accountId, networkId, transaction } = action.payload;
      if (!state.keleTransactions) {
        state.keleTransactions = {};
      }
      if (!state.keleTransactions[accountId]) {
        state.keleTransactions[accountId] = {};
      }
      const oldTransactions =
        state.keleTransactions[accountId][networkId] ?? [];
      const newTransactions = [transaction, ...oldTransactions];
      if (newTransactions.length > 30) {
        newTransactions.length = 30;
      }
      state.keleTransactions[accountId][networkId] = newTransactions;
    },
    archiveKeleTransaction(
      state,
      action: PayloadAction<{
        accountId: string;
        networkId: string;
        txs: string[];
      }>,
    ) {
      if (!state.keleTransactions) {
        return;
      }
      const { accountId, networkId, txs } = action.payload;
      const transactions = state.keleTransactions[accountId]?.[networkId];
      transactions.forEach((tx) => {
        if (txs.includes(tx.hash)) {
          tx.archive = true;
        }
      });
    },
    setStEthRate(
      state,
      action: PayloadAction<{ networkId: string; value: string }>,
    ) {
      if (!state.stEthRate) {
        state.stEthRate = {};
      }
      const { networkId, value } = action.payload;
      state.stEthRate[networkId] = value;
    },
  },
});

export const {
  // setAccountStakingActivity,
  // setKeleDashboardGlobal,
  setKeleNetworkDashboardGlobal,
  setKeleUnstakeOverview,
  setKeleWithdrawOverview,
  setKeleMinerOverviews,
  setKeleIncomes,
  setKelePendingWithdraw,
  // setHideUnstakeBulletin,
  setKeleOpHistory,
  setETHStakingApr,
  setLidoOverview,
  setLidoMaticOverview,
  addTransaction,
  addKeleTransaction,
  archiveTransaction,
  archiveKeleTransaction,
  setStEthRate,
} = stakingSlice.actions;

export default stakingSlice.reducer;
