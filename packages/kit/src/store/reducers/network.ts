import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import type { NetworkShort } from '@onekeyhq/engine/src/types/network';

export type Network = {
  nativeDisplayDecimals: number;
  tokenDisplayDecimals: number;
} & NetworkShort;

type InitialState = {
  network: Network[] | null;
};

const initialState: InitialState = {
  network: null,
};

export const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    updateNetworkMap: (
      state,
      action: PayloadAction<InitialState['network']>,
    ) => {
      state.network = action.payload;
    },
  },
});

export const { updateNetworkMap } = networkSlice.actions;

export default networkSlice.reducer;
