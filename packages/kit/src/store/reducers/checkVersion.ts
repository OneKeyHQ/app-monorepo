import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { VersionInfo } from '../../utils/updates/type';

type InitialState = {
  // 使用过的版本
  usedVersionHistory: string[];
  currentVersionFeature: VersionInfo | undefined;
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
      if (state.usedVersionHistory[0] === action.payload) return;

      state.usedVersionHistory.unshift(action.payload);
      while (state.usedVersionHistory.length > 20) {
        state.usedVersionHistory.pop();
      }
    },
    setUpdateActivationHint(state, action: PayloadAction<boolean>) {
      state.updateActivationHint = action.payload;
    },
  },
});

export const {
  setCurrentVersionFeature,
  addUsedVersionHistory,
  setUpdateActivationHint,
} = checkVersionSlice.actions;

export default checkVersionSlice.reducer;
