import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import type { Account as BaseAccount } from '@onekeyhq/engine/src/types/account';
import type { Network as BaseNetwork } from '@onekeyhq/engine/src/types/network';
import {
  Wallet as BaseWallet,
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/engine/src/types/wallet';

type InitialState = {
  wallets: BaseWallet[];
  networks: BaseNetwork[];
  /** accounts will always change by different wallet and different networks */
  accounts: BaseAccount[]; // accounts in current wallet and network
  displayPassphraseWalletIdList: string[]; // Passphrase Wallet can be displayed
};

const initialState: InitialState = {
  wallets: [],
  networks: [],
  accounts: [],
  displayPassphraseWalletIdList: [],
};

const WALLET_SORT_WEIGHT = {
  [WALLET_TYPE_HD]: 1,
  [WALLET_TYPE_HW]: 10,
  [WALLET_TYPE_IMPORTED]: 20,
  [WALLET_TYPE_WATCHING]: 30,
  [WALLET_TYPE_EXTERNAL]: 40,
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
      state.wallets = action.payload.sort(
        (item1, item2) =>
          WALLET_SORT_WEIGHT[item1.type] - WALLET_SORT_WEIGHT[item2.type],
      );
    },
    updateWallet(state, action: PayloadAction<BaseWallet>) {
      state.wallets = state.wallets.map((w) =>
        w.id === action.payload.id ? action.payload : w,
      );
    },
    addWallet(state, action: PayloadAction<BaseWallet>) {
      state.wallets.push(action.payload);
    },
    addDisplayPassphraseWallet(state, action: PayloadAction<string>) {
      if (!state.displayPassphraseWalletIdList.includes(action.payload)) {
        state.displayPassphraseWalletIdList = [
          ...state.displayPassphraseWalletIdList,
          action.payload,
        ];
      }
    },
    clearDisplayPassphraseWallet(state) {
      state.displayPassphraseWalletIdList = [];
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
  addDisplayPassphraseWallet,
  clearDisplayPassphraseWallet,
} = walletSlice.actions;

export default walletSlice.reducer;
