import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { CurrencyType, MoonpayListType } from '../../views/FiatPay/types';

export type DataInitialState = {
  isAppRenderReady: boolean;
  isUnlock: boolean;
  isPasswordSet: boolean;
  onekeySupportList: CurrencyType[];
  currencyList: MoonpayListType[];
  cursorMap: Record<string, string>;
};

const initialState: DataInitialState = {
  isUnlock: !!platformEnv.isDev, // isUnlock is in memory, so when app was killed/reload, it will be reset to false
  isPasswordSet: false,
  onekeySupportList: [],
  currencyList: [],
  isAppRenderReady: false,
  cursorMap: {},
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
    cursorMapSet(
      state,
      action: PayloadAction<{
        key: string;
        cursor: string;
      }>,
    ) {
      state.cursorMap[action.payload.key] = action.payload.cursor;
    },
  },
});

export const {
  release,
  passwordSet,
  currenciesSet,
  setAppRenderReady,
  cursorMapSet,
} = dataSlice.actions;

export default dataSlice.reducer;
