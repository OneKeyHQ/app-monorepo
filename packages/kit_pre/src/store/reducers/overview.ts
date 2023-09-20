import { createSlice } from '@reduxjs/toolkit';
import { isEmpty, omit, omitBy } from 'lodash';

import type { Account } from '@onekeyhq/engine/src/types/account';

import type { IOverviewQueryTaskItem } from '../../views/Overview/types';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface IOverviewStatsInfo {
  totalCounts?: number;
  totalValue: string | undefined;
  totalValue24h: string | undefined;
}
export interface IOverviewStatsSummary {
  totalValue: string | undefined;
  totalValue24h: string | undefined;
  shareTokens: string;
  shareDefis: string;
  shareNfts: string;
}
export interface IOverviewStats {
  summary?: IOverviewStatsSummary;
  tokens?: IOverviewStatsInfo;
  defis?: IOverviewStatsInfo;
  nfts?: IOverviewStatsInfo;
}
export interface IOverviewStatsPayload {
  [networkId: string]: {
    [accountId: string]: IOverviewStats;
  };
}

export interface IOverviewPortfolio {
  // allNetworks fake accountId = `${walletId}--${accountIndex}`
  // Recrod<accountId, Record<networkId, accounts>>
  allNetworksAccountsMap?: Record<string, Record<string, Account[]> | null>;
  tasks: Record<string, IOverviewQueryTaskItem>;
  overviewStats?: IOverviewStatsPayload;
}

const initialState: IOverviewPortfolio = {
  tasks: {},
  allNetworksAccountsMap: {},
  overviewStats: {},
};

export const overviewSlice = createSlice({
  name: 'overview',
  initialState,
  reducers: {
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
      if (isEmpty(state.tasks)) {
        return;
      }
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
    setAllNetworksAccountsMap(
      state,
      action: PayloadAction<{
        accountId: string;
        data: Record<string, Account[]> | null;
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
    removeMapNetworks(
      state,
      action: PayloadAction<{
        accountId?: string;
        networkIds: string[];
      }>,
    ) {
      const { networkIds, accountId } = action.payload;
      const map = state.allNetworksAccountsMap ?? {};

      if (accountId) {
        map[accountId] = omit(map[accountId], ...networkIds);
      } else {
        for (const k of Object.keys(map)) {
          map[k] = omit(map[k], ...networkIds);
        }
      }

      state.allNetworksAccountsMap = map;
    },
    removeWalletAccountsMap(
      state,
      action: PayloadAction<{
        walletIds: string[];
      }>,
    ) {
      const { walletIds } = action.payload;
      const map = state.allNetworksAccountsMap ?? {};

      state.allNetworksAccountsMap = omitBy(map, (_v, k) =>
        walletIds.find((id) => k.startsWith(id)),
      );
    },
    updateOverviewStats(
      state,
      action: PayloadAction<{
        accountId: string;
        networkId: string;
        stats: IOverviewStats;
      }>,
    ) {
      const { accountId, networkId, stats } = action.payload;
      if (!state.overviewStats) {
        state.overviewStats = {};
      }
      if (!state.overviewStats[networkId]) {
        state.overviewStats[networkId] = {};
      }
      if (!state.overviewStats[networkId][accountId]) {
        state.overviewStats[networkId][accountId] = {};
      }
      state.overviewStats[networkId][accountId] = {
        ...stats,
      };
    },
  },
});

export const {
  updateOverviewStats,
  addOverviewPendingTasks,
  removeOverviewPendingTasks,
  setAllNetworksAccountsMap,
  clearOverviewPendingTasks,
  removeAllNetworksAccountsMapByAccountId,
  removeMapNetworks,
  removeWalletAccountsMap,
} = overviewSlice.actions;

export default overviewSlice.reducer;
