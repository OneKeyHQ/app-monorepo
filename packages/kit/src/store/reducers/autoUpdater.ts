import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { DesktopVersion, VersionInfo } from '../../utils/updates/type';

export type UpdateError = {
  error: Error;
};

export type UpdateProgress = {
  total: number;
  delta: number;
  transferred: number;
  percent: number;
  bytesPerSecond: number;
};

export type UpdateWindow = 'maximized' | 'minimized' | 'hidden';

export interface AutoUpdaterState {
  enabled: boolean;
  state:
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'ready'
    | 'error';
  skip?: string;
  progress: UpdateProgress;
  latest?: VersionInfo | DesktopVersion;
  window: UpdateWindow;
}

const initialState: AutoUpdaterState = {
  enabled: false,
  state: 'not-available',
  window: 'maximized',
  progress: {} as UpdateProgress,
};

export const autoUpdaterSlice = createSlice({
  name: 'autoUpdater',
  initialState,
  reducers: {
    enable(state) {
      state.enabled = true;
    },
    disable(state) {
      state.enabled = false;
    },
    checking(state) {
      state.state = 'checking';
    },
    available(state, action: PayloadAction<VersionInfo | DesktopVersion>) {
      state.state = 'available';
      if (action.payload) {
        state.latest = action.payload;
      }
    },
    notAvailable(state, action: PayloadAction<VersionInfo | DesktopVersion>) {
      state.state = 'not-available';
      if (action.payload) {
        state.latest = action.payload;
      }
    },
    downloading(state, action: PayloadAction<UpdateProgress>) {
      state.state = 'downloading';
      state.progress = action.payload;
    },
    ready(state, action: PayloadAction<VersionInfo | DesktopVersion>) {
      state.state = 'ready';
      state.latest = action.payload;
    },
    skip(state, action: PayloadAction<string>) {
      state.state = 'not-available';
      state.skip = action.payload;
    },
    error(state) {
      if (state.state === 'downloading') {
        state.state = 'available';
      }
    },
    setUpdateWindow(state, action: PayloadAction<UpdateWindow>) {
      state.window = action.payload;
    },
  },
});

export const {
  enable,
  disable,
  checking,
  available,
  notAvailable,
  downloading,
  ready,
  skip,
  error,
  setUpdateWindow,
} = autoUpdaterSlice.actions;

export default autoUpdaterSlice.reducer;
