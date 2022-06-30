import { createSlice } from '@reduxjs/toolkit';

const NAME = 'refresher';

const initialState = {
  refreshHistoryTs: 0,
};

export const slicer = createSlice({
  name: NAME,
  initialState,
  reducers: {
    refreshHistory(state) {
      state.refreshHistoryTs = Date.now();
    },
  },
});

export const { refreshHistory } = slicer.actions;

export default slicer.reducer;
