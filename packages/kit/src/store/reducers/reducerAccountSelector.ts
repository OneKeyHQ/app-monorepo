import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import type { INetwork, IWallet } from '@onekeyhq/engine/src/types';

import type { AccountGroup } from '../../components/Header/AccountSelectorChildren/RightAccountSection/ItemSection';

export const REDUCER_NAME_ACCOUNT_SELECTOR = 'accountSelector';

type InitialState = {
  selectedWallet: IWallet | null;
  selectedNetwork: INetwork | null;
  isSelectorOpen: boolean;
  accountsInGroupLoading: boolean;
  accountsInGroup: {
    walletId?: string;
    networkId?: string;
    payload: AccountGroup[];
  };
};

const initialState: InitialState = {
  selectedWallet: null,
  selectedNetwork: null,
  // check packages/kit/src/components/Header/AccountSelector.tsx
  //      const visible = isSmallLayout ? isDrawerOpen : innerVisible;
  isSelectorOpen: false,
  accountsInGroupLoading: false,
  accountsInGroup: {
    payload: [],
  },
};

export const reducerSlice = createSlice({
  name: REDUCER_NAME_ACCOUNT_SELECTOR,
  initialState,
  reducers: {
    updateSelectedWallet(
      state,
      action: PayloadAction<InitialState['selectedWallet']>,
    ) {
      state.selectedWallet = action.payload;
    },
    updateSelectedNetwork(
      state,
      action: PayloadAction<InitialState['selectedNetwork']>,
    ) {
      state.selectedNetwork = action.payload;
    },
    updateIsSelectorOpen(
      state,
      action: PayloadAction<InitialState['isSelectorOpen']>,
    ) {
      if (state.isSelectorOpen !== action.payload) {
        state.isSelectorOpen = action.payload;
      }
    },
    updateAccountsInGroupLoading(
      state,
      action: PayloadAction<InitialState['accountsInGroupLoading']>,
    ) {
      if (state.accountsInGroupLoading !== action.payload) {
        state.accountsInGroupLoading = action.payload;
      }
    },
    updateAccountsInGroup(
      state,
      action: PayloadAction<InitialState['accountsInGroup']>,
    ) {
      state.accountsInGroup = action.payload;
    },
  },
});

export default reducerSlice;
