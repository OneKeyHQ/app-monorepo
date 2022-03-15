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
    updateWallet(state, action: PayloadAction<BaseWallet>) {
      state.wallets = state.wallets.map((w) =>
        w.id === action.payload.id ? action.payload : w,
      );
    },
    addWallet(state, action: PayloadAction<BaseWallet>) {
      state.wallets.push(action.payload);
    },
  },
});

export const { updateWallets, updateWallet, addWallet } = walletSlice.actions;

export default walletSlice.reducer;
