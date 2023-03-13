import { createSlice } from '@reduxjs/toolkit';

import type { Account as BaseAccount } from '@onekeyhq/engine/src/types/account';
import type { Network as BaseNetwork } from '@onekeyhq/engine/src/types/network';
import type { Wallet as BaseWallet } from '@onekeyhq/engine/src/types/wallet';

import type { PayloadAction } from '@reduxjs/toolkit';

type InitialState = {
  onBoardingLoadingBehindModal: boolean;
  wallets: BaseWallet[];
  networks: BaseNetwork[];
  /** accounts will always change by different wallet and different networks */
  accounts: BaseAccount[]; // accounts only in current wallet and network, not all accounts in db
  displayPassphraseWalletIdList: string[]; // walletId, Passphrase Wallet can be displayed
};

const initialState: InitialState = {
  onBoardingLoadingBehindModal: false,
  wallets: [],
  networks: [],
  accounts: [],
  displayPassphraseWalletIdList: [],
};

export const walletSlice = createSlice({
  name: 'runtime',
  initialState,
  reducers: {
    setOnBoardingLoadingBehindModal: (
      state,
      action: PayloadAction<InitialState['onBoardingLoadingBehindModal']>,
    ) => {
      state.onBoardingLoadingBehindModal = action.payload;
    },
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
  setOnBoardingLoadingBehindModal,
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
