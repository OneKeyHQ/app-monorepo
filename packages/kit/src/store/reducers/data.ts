import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { CurrencyType, MoonpayListType } from '../../views/FiatPay/types';

export type DataInitialState = {
  isUnlock: boolean;
  isPasswordSet: boolean;
  onekeySupportList: CurrencyType[];
  currencyList: MoonpayListType[];
};

const initialState: DataInitialState = {
  isUnlock: platformEnv.isNative ? !!platformEnv.isDev : true, // isUnlock is in memory, so when app was killed/reload, it will be reset to false
  isPasswordSet: false,
  onekeySupportList: [],
  currencyList: [],
};

export const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
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

export const { release, passwordSet, currenciesSet } = dataSlice.actions;

export default dataSlice.reducer;
