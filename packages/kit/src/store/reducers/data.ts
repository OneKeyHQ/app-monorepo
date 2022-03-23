import { createSlice } from '@reduxjs/toolkit';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export type DataInitialState = {
  isUnlock: boolean;
};

const initialState: DataInitialState = {
  isUnlock: platformEnv.isNative ? !!platformEnv.isDev : true, // isUnlock is in memory, so when app was killed/reload, it will be reset to false
};

console.log('platformEnv.isDev', !!platformEnv.isDev);

export const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    unlock(state) {
      state.isUnlock = true;
    },
  },
});

export const { unlock } = dataSlice.actions;

export default dataSlice.reducer;
