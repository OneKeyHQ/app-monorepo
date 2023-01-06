import { createSlice } from '@reduxjs/toolkit';

import type { Tool } from '@onekeyhq/engine/src/types/token';
import { stopTrace } from '@onekeyhq/shared/src/perf/perfTrace';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { CurrencyType, MoonpayListType } from '../../views/FiatPay/types';
import type { PayloadAction } from '@reduxjs/toolkit';

export type DataInitialState = {
  isAppRenderReady: boolean;
  isUnlock: boolean;
  isPasswordSet: boolean;
  homePageCheckBoarding: boolean;
  isExtUiReduxReady?: boolean;
  onekeySupportList: CurrencyType[];
  currencyList: MoonpayListType[];
  cursorMap: Record<string, string>;
  handOperatedLock?: boolean;
  feePresetIndexMap?: Record<string, string | undefined>;
  tools: Tool[];
  translations?: Record<string, Record<string, string>>;
};

const initialState: DataInitialState = {
  isUnlock: !!platformEnv.isDev, // isUnlock is in memory, so when app was killed/reload, it will be reset to false
  isPasswordSet: false,
  isExtUiReduxReady: false,
  homePageCheckBoarding: false,
  onekeySupportList: [],
  currencyList: [],
  isAppRenderReady: false,
  cursorMap: {},
  tools: [],
  translations: {},
};

export const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    setAppRenderReady(state) {
      stopTrace('js_render');
      state.isAppRenderReady = true;
    },
    setIsExtUiReduxReady(state) {
      state.isExtUiReduxReady = true;
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
    setHomePageCheckBoarding(state) {
      state.homePageCheckBoarding = true;
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
    setTools(state, action: PayloadAction<Tool[]>) {
      state.tools = action.payload;
    },
    setTranslations(
      state,
      actions: PayloadAction<Record<string, Record<string, string>>>,
    ) {
      state.translations = actions.payload;
    },
  },
});

export const {
  release,
  passwordSet,
  setHomePageCheckBoarding,
  currenciesSet,
  setAppRenderReady,
  setIsExtUiReduxReady,
  cursorMapSet,
  lock,
  setHandOperatedLock,
  setFeePresetIndex,
  setTools,
  setTranslations,
} = dataSlice.actions;

export default dataSlice.reducer;
