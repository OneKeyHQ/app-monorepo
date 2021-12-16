import { PayloadAction, createSlice } from '@reduxjs/toolkit';

export type UpdateInfo = {
  version: string;
  releaseDate: string;
  isManualCheck?: boolean;
  downloadedFile?: string;
};

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
  progress?: UpdateProgress;
  latest?: UpdateInfo;
  window: UpdateWindow;
}

const initialState: AutoUpdaterState = {
  enabled: false,
  state: 'not-available',
  window: 'maximized',
};

export const autoUpdaterSlice = createSlice({
  name: 'autoUpdater',
  initialState,
  reducers: {
    enable(state) {
      state.enabled = true;
    },
    checking(state) {
      state.state = 'checking';
    },
    available(state, action: PayloadAction<UpdateInfo>) {
      state.state = 'available';
      state.latest = action.payload;
    },
    notAvailable(state, action: PayloadAction<UpdateInfo>) {
      state.state = 'not-available';
      state.latest = action.payload;
    },
    downloading(state, action: PayloadAction<UpdateProgress>) {
      state.state = 'downloading';
      state.progress = action.payload;
    },
    ready(state, action: PayloadAction<UpdateInfo>) {
      state.state = 'ready';
      state.latest = action.payload;
    },
    skip(state, action: PayloadAction<string>) {
      state.state = 'not-available';
      state.skip = action.payload;
    },
    error(state) {
      state.state = 'error';
    },
    setUpdateWindow(state, action: PayloadAction<UpdateWindow>) {
      state.window = action.payload;
    },
  },
});

export const {
  enable,
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
