import { createSlice } from '@reduxjs/toolkit';

import type { PayloadAction } from '@reduxjs/toolkit';

const NAME = 'refresher';

export type IBackgroundShowToastOptions = {
  title: string;
  type: 'success' | 'error' | 'info';
};

type InitialState = {
  refreshHomeOverviewTs?: number; // TODO rename refreshHomeTokensTs
  refreshHistoryTs: number;
  refreshAccountSelectorTs: number;
  refreshConnectedSitesTs: number;
  closeDappConnectionPreloadingTs: number;
  backgroundShowToastTs: number;
  backgroundShowToastOptions: IBackgroundShowToastOptions;
  overviewAccountIsUpdating?: Record<string, boolean>;
  overviewHomeTokensLoading?: boolean;
};
const initialState: InitialState = {
  overviewAccountIsUpdating: {},
  overviewHomeTokensLoading: false,
  refreshHomeOverviewTs: 0,
  refreshHistoryTs: 0,
  refreshAccountSelectorTs: 0,
  refreshConnectedSitesTs: 0,
  closeDappConnectionPreloadingTs: 0,
  backgroundShowToastTs: 0,
  backgroundShowToastOptions: {
    title: '',
    type: 'info',
  },
};

export const slicer = createSlice({
  name: NAME,
  initialState,
  reducers: {
    setOverviewHomeTokensLoading(state, action: PayloadAction<boolean>) {
      const loading = action.payload;
      if (loading !== state.overviewHomeTokensLoading) {
        state.overviewHomeTokensLoading = loading;
      }
    },
    // original: setAccountIsUpdating
    setOverviewAccountIsUpdating(
      state,
      action: PayloadAction<{
        accountId: string;
        data: boolean;
      }>,
    ) {
      const { accountId, data } = action.payload;
      if (!state.overviewAccountIsUpdating) {
        state.overviewAccountIsUpdating = {};
      }
      state.overviewAccountIsUpdating[accountId] = data;
    },
    updateRefreshHomeOverviewTs(state) {
      state.refreshHomeOverviewTs = Date.now();
    },
    refreshHistory(state) {
      state.refreshHistoryTs = Date.now();
    },
    refreshAccountSelector(state) {
      state.refreshAccountSelectorTs = Date.now();
    },
    refreshConnectedSites(state) {
      state.refreshConnectedSitesTs = Date.now();
    },
    closeDappConnectionPreloading(state) {
      state.closeDappConnectionPreloadingTs = Date.now();
    },
    resetDappConnectionPreloading(state) {
      state.closeDappConnectionPreloadingTs = 0;
    },
    backgroundShowToast(
      state,
      action: PayloadAction<IBackgroundShowToastOptions>,
    ) {
      state.backgroundShowToastOptions = action.payload;
      state.backgroundShowToastTs = Date.now();
    },
  },
});

export const {
  setOverviewHomeTokensLoading,
  setOverviewAccountIsUpdating,
  updateRefreshHomeOverviewTs,
  refreshHistory,
  refreshAccountSelector,
  refreshConnectedSites,
  closeDappConnectionPreloading,
  resetDappConnectionPreloading,
  backgroundShowToast,
} = slicer.actions;

export default slicer.reducer;
