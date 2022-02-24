import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import type { Wallet as BaseWallet } from '@onekeyhq/engine/src/types/wallet';

type InitialState = {
  wallets: BaseWallet[];
};

const initialState: InitialState = {
  wallets: [],
};

export const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    updateWallets(state, action: PayloadAction<BaseWallet[]>) {
      state.wallets = action.payload;
    },
  },
});

export const { updateWallets } = walletSlice.actions;

export default walletSlice.reducer;
