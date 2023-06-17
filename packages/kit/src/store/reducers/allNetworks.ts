import { createSlice } from '@reduxjs/toolkit';

import type { PayloadAction } from '@reduxjs/toolkit';

export interface AllNetworksState {
  walletId: string | undefined;
  accountIndex: number | undefined;
}

const initialState: AllNetworksState = {
  walletId: undefined,
  accountIndex: undefined,
};

export const allNetworkSlice = createSlice({
  name: 'allNetworks',
  initialState,
  reducers: {
    selectAllNetworksAccount(
      state,
      action: PayloadAction<{
        accountIndex?: number;
        walletId?: string;
      }>,
    ) {
      state.walletId = action.payload.walletId;
      state.accountIndex = action.payload.accountIndex;
    },
  },
});

export const { selectAllNetworksAccount } = allNetworkSlice.actions;

export default allNetworkSlice.reducer;
