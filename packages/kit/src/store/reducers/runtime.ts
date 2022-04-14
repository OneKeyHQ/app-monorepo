import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import type { Account as BaseAccount } from '@onekeyhq/engine/src/types/account';
import type { Network as BaseNetwork } from '@onekeyhq/engine/src/types/network';
import type { Wallet as BaseWallet } from '@onekeyhq/engine/src/types/wallet';

export type INetwork = BaseNetwork;
export type IWallet = BaseWallet;

type InitialState = {
  wallets: BaseWallet[];
  networks: BaseNetwork[];
  /** accounts will always change by different wallet and different networks */
  accounts: BaseAccount[];
};

const initialState: InitialState = {
  wallets: [],
  networks: [],
  accounts: [],
};

export const walletSlice = createSlice({
  name: 'runtime',
  initialState,
  reducers: {
    updateAccountDetail: (
      state,
      action: PayloadAction<Partial<BaseAccount> & { name: string }>,
    ) => {
      const { id, name } = action.payload;
      const index = state.accounts.findIndex((account) => account.id === id);
      state.accounts[index] = {
        ...state.accounts[index],
        name,
      };
    },
    updateAccounts: (
      state,
      action: PayloadAction<InitialState['accounts']>,
    ) => {
      state.accounts = action.payload;
    },
    updateNetworks: (
      state,
      action: PayloadAction<InitialState['networks']>,
    ) => {
      state.networks = action.payload;
    },
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

export const {
  updateWallets,
  updateWallet,
  addWallet,
  updateNetworks,
  updateAccounts,
  updateAccountDetail,
} = walletSlice.actions;

export default walletSlice.reducer;
