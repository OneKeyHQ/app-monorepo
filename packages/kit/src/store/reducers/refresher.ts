import { createSlice } from '@reduxjs/toolkit';

const NAME = 'refresher';

type InitialState = {
  refreshHistoryTs: number;
  refreshAccountSelectorTs: number;
  refreshConnectedSitesTs: number;
  closeDappConnectionPreloadingTs: number;
};
const initialState: InitialState = {
  refreshHistoryTs: 0,
  refreshAccountSelectorTs: 0,
  refreshConnectedSitesTs: 0,
  closeDappConnectionPreloadingTs: 0,
};

export const slicer = createSlice({
  name: NAME,
  initialState,
  reducers: {
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
  },
});

export const {
  refreshHistory,
  refreshAccountSelector,
  refreshConnectedSites,
  closeDappConnectionPreloading,
  resetDappConnectionPreloading,
} = slicer.actions;

export default slicer.reducer;
