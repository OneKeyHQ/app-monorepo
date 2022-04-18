import { PayloadAction, createSlice } from '@reduxjs/toolkit';

type StatusState = {
  lastActivity: number;
  isUnlock: boolean;
  boardingCompleted: boolean;
  supportFaceId: boolean;
  webviewGlobalKey: number;
};

const initialState: StatusState = {
  lastActivity: 0,
  isUnlock: false,
  boardingCompleted: false,
  supportFaceId: true,
  webviewGlobalKey: 0,
};

export const slice = createSlice({
  name: 'status',
  initialState,
  reducers: {
    setBoardingCompleted: (state) => {
      state.boardingCompleted = true;
    },
    setSupportFaceId: (state) => {
      state.supportFaceId = true;
    },
    unlock: (state) => {
      state.lastActivity = Date.now();
      state.isUnlock = true;
    },
    lock: (state) => {
      state.isUnlock = false;
    },
    refreshLastActivity: (
      state,
      action?: PayloadAction<number | undefined>,
    ) => {
      state.lastActivity = action?.payload || Date.now();
    },
    refreshWebviewGlobalKey: (state) => {
      state.webviewGlobalKey = Date.now();
    },
    reset: () => {},
  },
});

export const {
  reset,
  setBoardingCompleted,
  setSupportFaceId,
  lock,
  unlock,
  refreshLastActivity,
  refreshWebviewGlobalKey,
} = slice.actions;

export default slice.reducer;
