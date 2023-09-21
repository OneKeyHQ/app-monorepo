import { createSlice } from '@reduxjs/toolkit';

import type { AccountGroup } from '../../components/NetworkAccountSelector/types';
import type { PayloadAction } from '@reduxjs/toolkit';

export enum EAccountSelectorMode {
  Wallet = 'Wallet',
  Transfer = 'Transfer',
}
type InitialState = {
  accountSelectorMode: EAccountSelectorMode;
  isDesktopWalletSelectorVisible: boolean;
  isMobileWalletSelectorDrawerOpen: boolean;
  isOpen: boolean;
  isOpenDelay: boolean; // isOpenDelay 600ms
  isLoading: boolean;
  isRefreshDisabled: boolean;
  walletId?: string;
  networkId?: string;
  accountsGroup: AccountGroup[];
  preloadingCreateAccount?: {
    networkId?: string;
    walletId?: string;
    accountId?: string;
    template?: string;
  };
};

const initialState: InitialState = {
  accountSelectorMode: EAccountSelectorMode.Wallet,
  isDesktopWalletSelectorVisible: false,
  isMobileWalletSelectorDrawerOpen: false,
  isOpen: false,
  isOpenDelay: false,
  isLoading: false,
  isRefreshDisabled: false,
  walletId: undefined,
  networkId: undefined,
  accountsGroup: [],
  preloadingCreateAccount: undefined,
};

export const reducerSlice = createSlice({
  name: 'accountSelector',
  initialState,
  reducers: {
    updateAccountSelectorMode(
      state,
      action: PayloadAction<InitialState['accountSelectorMode']>,
    ) {
      if (state.accountSelectorMode !== action.payload) {
        state.accountSelectorMode = action.payload;
      }
    },
    updateDesktopWalletSelectorVisible(
      state,
      action: PayloadAction<InitialState['isDesktopWalletSelectorVisible']>,
    ) {
      state.isDesktopWalletSelectorVisible = action.payload;
    },
    updateMobileWalletSelectorDrawerOpen(
      state,
      action: PayloadAction<InitialState['isMobileWalletSelectorDrawerOpen']>,
    ) {
      state.isMobileWalletSelectorDrawerOpen = action.payload;
    },
    updateSelectedWalletId(
      state,
      action: PayloadAction<InitialState['walletId']>,
    ) {
      state.walletId = action.payload;
    },
    updateSelectedNetworkId(
      state,
      action: PayloadAction<InitialState['networkId']>,
    ) {
      state.networkId = action.payload;
    },
    updateIsOpenDelay(
      state,
      action: PayloadAction<InitialState['isOpenDelay']>,
    ) {
      if (state.isOpenDelay !== action.payload) {
        state.isOpenDelay = action.payload;
      }
    },
    updateIsOpen(state, action: PayloadAction<InitialState['isOpen']>) {
      if (state.isOpen !== action.payload) {
        state.isOpen = action.payload;
      }
    },
    updateIsLoading(state, action: PayloadAction<InitialState['isLoading']>) {
      if (state.isLoading !== action.payload) {
        state.isLoading = action.payload;
      }
    },
    updateIsRefreshDisabled(
      state,
      action: PayloadAction<InitialState['isRefreshDisabled']>,
    ) {
      if (state.isRefreshDisabled !== action.payload) {
        state.isRefreshDisabled = action.payload;
      }
    },
    updateAccountsGroup(
      state,
      action: PayloadAction<InitialState['accountsGroup']>,
    ) {
      state.accountsGroup = action.payload;
    },
    updatePreloadingCreateAccount(
      state,
      action: PayloadAction<InitialState['preloadingCreateAccount']>,
    ) {
      state.preloadingCreateAccount = action.payload;
    },
  },
});

export default reducerSlice;
