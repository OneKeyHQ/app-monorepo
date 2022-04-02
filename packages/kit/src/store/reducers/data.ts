import { createSlice } from '@reduxjs/toolkit';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export type DataInitialState = {
  isUnlock: boolean;
  isPasswordSet: boolean;
};

const initialState: DataInitialState = {
  isUnlock: platformEnv.isNative ? !!platformEnv.isDev : true, // isUnlock is in memory, so when app was killed/reload, it will be reset to false
  isPasswordSet: false,
};

export const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    unlock(state) {
      state.isUnlock = true;
    },
    passwordSet(state) {
      state.isPasswordSet = true;
    },
  },
});

export const { unlock, passwordSet } = dataSlice.actions;

export default dataSlice.reducer;
