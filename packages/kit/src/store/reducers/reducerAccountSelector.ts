import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import type { AccountGroup } from '../../components/Header/AccountSelectorChildren/RightAccountSection/ItemSection';

type InitialState = {
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
  };
};

const initialState: InitialState = {
  // check packages/kit/src/components/Header/AccountSelector.tsx
  //      const visible = isSmallLayout ? isDrawerOpen : innerVisible;
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
