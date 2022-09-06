import { createSlice } from '@reduxjs/toolkit';

const NAME = 'refresher';

type InitialState = {
  refreshHistoryTs: number;
  refreshAccountSelectorTs: number;
};
const initialState: InitialState = {
  refreshHistoryTs: 0,
  refreshAccountSelectorTs: 0,
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
  },
});

export const { refreshHistory, refreshAccountSelector } = slicer.actions;

export default slicer.reducer;
