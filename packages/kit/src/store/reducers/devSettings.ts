import { PayloadAction, createSlice } from '@reduxjs/toolkit';

type InitialState = {
  debugMode: boolean;
  testVersionUpdate: boolean;
};

const initialState: InitialState = {
  debugMode: false,
  testVersionUpdate: false,
};

export const devSettingsSlice = createSlice({
  name: 'devSettings',
  initialState,
  reducers: {
    setDebugMode(state, action: PayloadAction<boolean>) {
      state.debugMode = action.payload;
    },
    setTestVersionUpdate(state, action: PayloadAction<boolean>) {
      state.testVersionUpdate = action.payload;
    },
  },
});

export const { setDebugMode, setTestVersionUpdate } = devSettingsSlice.actions;

export default devSettingsSlice.reducer;
