import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { VersionInfo } from '../../utils/updates/type';

export type UsedVersionHistory = {
  version: string;
  reminded: boolean;
};

type InitialState = {
  // 使用过的版本
  usedVersionHistory: UsedVersionHistory[];
  currentVersionFeature: VersionInfo | undefined;
  // TODO 后续使用 autoUpdate 来判断是否需要弹窗
  updateActivationHint: boolean;
};

const initialState: InitialState = {
  usedVersionHistory: [],
  currentVersionFeature: undefined,
  updateActivationHint: false,
};

export const checkVersionSlice = createSlice({
  name: 'checkVersion',
  initialState,
  reducers: {
    setCurrentVersionFeature(state, action: PayloadAction<VersionInfo>) {
      state.currentVersionFeature = action.payload;
    },
    addUsedVersionHistory(state, action: PayloadAction<string>) {
      if (state.usedVersionHistory[0]?.version === action.payload) return;

      state.usedVersionHistory.unshift({
        version: action.payload,
        reminded: false,
      });

      while (state.usedVersionHistory.length > 20) {
        state.usedVersionHistory.pop();
      }
    },
    newFeatureAlert(state) {
      if (!state.usedVersionHistory[0]) return;
      state.usedVersionHistory[0].reminded = true;
    },
    setUpdateActivationHint(state, action: PayloadAction<boolean>) {
      state.updateActivationHint = action.payload;
    },
  },
});

export const {
  setCurrentVersionFeature,
  addUsedVersionHistory,
  newFeatureAlert,
  setUpdateActivationHint,
} = checkVersionSlice.actions;

export default checkVersionSlice.reducer;
