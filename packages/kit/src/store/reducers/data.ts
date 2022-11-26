import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { stopTrace } from '@onekeyhq/shared/src/perf/perfTrace';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { CurrencyType, MoonpayListType } from '../../views/FiatPay/types';

export type DataInitialState = {
  isAppRenderReady: boolean;
  isUnlock: boolean;
  isPasswordSet: boolean;
  isReduxReady?: boolean;
  onekeySupportList: CurrencyType[];
  currencyList: MoonpayListType[];
  cursorMap: Record<string, string>;
  handOperatedLock?: boolean;
  feePresetIndexMap?: Record<string, string | undefined>;
};

const initialState: DataInitialState = {
  isUnlock: !!platformEnv.isDev, // isUnlock is in memory, so when app was killed/reload, it will be reset to false
  isPasswordSet: false,
  isReduxReady: false,
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
      stopTrace('js_render');
      state.isAppRenderReady = true;
    },
    setIsReduxReady(state) {
      state.isReduxReady = true;
    },
    release(state) {
      state.isUnlock = true;
    },
    lock(state) {
      state.isUnlock = false;
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
    setHandOperatedLock(state, action: PayloadAction<boolean>) {
      state.handOperatedLock = action.payload;
    },
    setFeePresetIndex(
      state,
      action: PayloadAction<{ networkId: string; index: string }>,
    ) {
      if (!state.feePresetIndexMap) {
        state.feePresetIndexMap = {};
      }
      state.feePresetIndexMap[action.payload.networkId] = action.payload.index;
    },
  },
});

export const {
  release,
  passwordSet,
  currenciesSet,
  setAppRenderReady,
  setIsReduxReady,
  cursorMapSet,
  lock,
  setHandOperatedLock,
  setFeePresetIndex,
} = dataSlice.actions;

export default dataSlice.reducer;
