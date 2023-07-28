import { createSlice } from '@reduxjs/toolkit';
import { omit } from 'lodash';

import type { Account } from '@onekeyhq/engine/src/types/account';

import type { IOverviewQueryTaskItem } from '../../views/Overview/types';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface IPortfolioUpdatedAt {
  updatedAt: number;
}

export interface IOverviewPortfolio {
  // allNetworks fake accountId = `${walletId}--${accountIndex}`
  // Recrod<accountId, Record<networkId, accounts>>
  allNetworksAccountsMap?: Record<string, Record<string, Account[]>>;
  tasks: Record<string, IOverviewQueryTaskItem>;
  updatedTimeMap: Record<string, IPortfolioUpdatedAt>;
  // Recrod<accountId, boolean>
  accountIsUpdating?: Record<string, boolean>;
}

const initialState: IOverviewPortfolio = {
  tasks: {},
  updatedTimeMap: {},
  allNetworksAccountsMap: {},
  accountIsUpdating: {},
};

export const overviewSlice = createSlice({
  name: 'overview',
  initialState,
  reducers: {
    setOverviewPortfolioUpdatedAt(
      state,
      action: PayloadAction<{
        key: string;
        data: IPortfolioUpdatedAt;
      }>,
    ) {
      const { data, key } = action.payload;
      if (!state.updatedTimeMap) {
        state.updatedTimeMap = {};
      }
      state.updatedTimeMap[key] = data;
    },
    addOverviewPendingTasks(
      state,
      action: PayloadAction<{
        data: IOverviewPortfolio['tasks'];
      }>,
    ) {
      const { data } = action.payload;
      if (!state.tasks) {
        state.tasks = {};
      }
      state.tasks = {
        ...state.tasks,
        ...data,
      };
    },
    clearOverviewPendingTasks(state) {
      state.tasks = {};
    },
    removeOverviewPendingTasks(
      state,
      action: PayloadAction<{
        ids: string[];
      }>,
    ) {
      const { ids = [] } = action.payload;
      if (!state.tasks) {
        return;
      }
      state.tasks = omit(state.tasks, ...ids);
    },
    setAccountIsUpdating(
      state,
      action: PayloadAction<{
        accountId: string;
        data: boolean;
      }>,
    ) {
      const { accountId, data } = action.payload;
      if (!state.accountIsUpdating) {
        state.accountIsUpdating = {};
      }
      state.accountIsUpdating[accountId] = data;
    },
    setAllNetworksAccountsMap(
      state,
      action: PayloadAction<{
        accountId: string;
        data: Record<string, Account[]>;
      }>,
    ) {
      const { accountId, data } = action.payload;
      if (!state.allNetworksAccountsMap) {
        state.allNetworksAccountsMap = {};
      }
      state.allNetworksAccountsMap[accountId] = data;
    },
    removeAllNetworksAccountsMapByAccountId(
      state,
      action: PayloadAction<{
        accountId: string;
      }>,
    ) {
      const { accountId } = action.payload;
      if (!state.allNetworksAccountsMap) {
        return;
      }
      delete state.allNetworksAccountsMap?.[accountId];
    },
  },
});

export const {
  addOverviewPendingTasks,
  removeOverviewPendingTasks,
  setOverviewPortfolioUpdatedAt,
  setAccountIsUpdating,
  setAllNetworksAccountsMap,
  clearOverviewPendingTasks,
  removeAllNetworksAccountsMapByAccountId,
} = overviewSlice.actions;

export default overviewSlice.reducer;
