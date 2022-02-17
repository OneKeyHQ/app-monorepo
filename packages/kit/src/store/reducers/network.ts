import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import type { NetworkShort } from '@onekeyhq/engine/src/types/network';

type InitialState = {
  network: NetworkShort[] | null;
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
