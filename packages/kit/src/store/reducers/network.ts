import { createSlice } from '@reduxjs/toolkit';

import type { Network } from '../typings';
import type { PayloadAction } from '@reduxjs/toolkit';

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
