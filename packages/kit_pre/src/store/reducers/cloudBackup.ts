import { createSlice } from '@reduxjs/toolkit';

import type { PayloadAction } from '@reduxjs/toolkit';

type CloudBackupState = {
  isAvailable: boolean;
  inProgress: boolean;
  enabled: boolean;
  backupRequests: number;
  lastBackup?: number;
};

const initialState: CloudBackupState = {
  isAvailable: false,
  inProgress: false,
  enabled: false,
  backupRequests: 1,
  lastBackup: undefined,
};

export const slice = createSlice({
  name: 'cloudBackup',
  initialState,
  reducers: {
    setIsAvailable(state, action: PayloadAction<boolean>) {
      state.isAvailable = action.payload;
    },
    setInProgress(state) {
      if (state.inProgress) {
        return;
      }
      state.backupRequests = 0;
      state.inProgress = true;
    },
    setNotInProgress(state) {
      if (!state.inProgress) {
        return;
      }
      state.lastBackup = Date.now();
      state.inProgress = false;
    },
    setEnabled(state) {
      state.enabled = true;
    },
    setDisabled(state) {
      state.enabled = false;
      state.backupRequests = 0;
      state.lastBackup = undefined;
    },
    incrBackupRequests(state) {
      state.backupRequests += 1;
    },
  },
});

export const {
  setIsAvailable,
  setInProgress,
  setNotInProgress,
  setEnabled,
  setDisabled,
  incrBackupRequests,
} = slice.actions;

export default slice.reducer;
