import { createSlice } from '@reduxjs/toolkit';

import type { Tool } from '@onekeyhq/engine/src/types/token';
import { stopTrace } from '@onekeyhq/shared/src/perf/perfTrace';

import type { ProtectedBaseProps } from '../../components/Protected';
import type { PayloadAction } from '@reduxjs/toolkit';

export type DataInitialState = {
  isAppRenderReady: boolean;
  isPasswordSet: boolean;
  homePageCheckBoarding: boolean;
  cursorMap: Record<string, string>;
  handOperatedLock?: boolean;
  feePresetIndexMap?: Record<string, string | undefined>;
  tools: Tool[];
  translations?: Record<string, Record<string, string>>;
  isPasswordLoadedInVault?: boolean;
  backgroudPasswordPrompt?: {
    promiseId: number;
    props?: ProtectedBaseProps;
  };
};

const initialState: DataInitialState = {
  isPasswordSet: false,
  homePageCheckBoarding: false,
  isAppRenderReady: false,
  isPasswordLoadedInVault: false,
  cursorMap: {},
  tools: [],
  translations: {},
};

export const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    setIsPasswordLoadedInVault(state, action) {
      state.isPasswordLoadedInVault = action.payload;
    },
    setAppRenderReady(state) {
      stopTrace('js_render');
      state.isAppRenderReady = true;
    },
    passwordSet(state) {
      state.isPasswordSet = true;
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
    clearTranslations(state) {
      state.translations = undefined;
    },
    setBackgroundPasswordPrompt(
      state,
      action: PayloadAction<{
        promiseId: number;
        props?: ProtectedBaseProps;
      }>,
    ) {
      state.backgroudPasswordPrompt = action.payload;
    },
  },
});

export const {
  passwordSet,
  setHomePageCheckBoarding,
  setAppRenderReady,
  cursorMapSet,
  setHandOperatedLock,
  setFeePresetIndex,
  setTools,
  clearTranslations,
  setIsPasswordLoadedInVault,
  setBackgroundPasswordPrompt,
} = dataSlice.actions;

export default dataSlice.reducer;
