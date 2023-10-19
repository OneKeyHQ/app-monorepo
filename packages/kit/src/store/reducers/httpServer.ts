import { createSlice } from '@reduxjs/toolkit';

import type { PayloadAction } from '@reduxjs/toolkit';

type HttpServerState = {
  enabled: boolean;
  address: string;
};

const initialState: HttpServerState = {
  enabled: false,
  address: '',
};

export const slice = createSlice({
  name: 'HttpServer',
  initialState,
  reducers: {
    setEnabled(state, action: PayloadAction<boolean>) {
      state.enabled = action.payload;
    },
  },
});

export const { setEnabled } = slice.actions;

export default slice.reducer;
