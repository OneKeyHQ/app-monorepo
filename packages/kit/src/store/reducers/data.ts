import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { CurrencyType, MoonpayListType } from '../../views/FiatPay/types';

export type DataInitialState = {
  isAppRenderReady: boolean;
  isUnlock: boolean;
  isPasswordSet: boolean;
  onekeySupportList: CurrencyType[];
  currencyList: MoonpayListType[];
};

const initialState: DataInitialState = {
  isUnlock: !!platformEnv.isDev, // isUnlock is in memory, so when app was killed/reload, it will be reset to false
  isPasswordSet: false,
  onekeySupportList: [],
  currencyList: [],
  isAppRenderReady: false,
};

export const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    setAppRenderReady(state) {
      state.isAppRenderReady = true;
    },
    release(state) {
      state.isUnlock = true;
    },
    passwordSet(state) {
      state.isPasswordSet = true;
    },
    currenciesSet(
      state,
      action: PayloadAction<{
        onekeySupportList: CurrencyType[];
        currencyList: MoonpayListType[];
      }>,
    ) {
      state.onekeySupportList = action.payload.onekeySupportList;
      state.currencyList = action.payload.currencyList;
    },
  },
});

export const { release, passwordSet, currenciesSet, setAppRenderReady } =
  dataSlice.actions;

export default dataSlice.reducer;
