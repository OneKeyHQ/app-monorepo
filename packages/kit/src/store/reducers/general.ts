import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import type { NetworkShort } from '@onekeyhq/engine/src/types/network';
import type { Wallet as BaseWallet } from '@onekeyhq/engine/src/types/wallet';

type Account = { address: string; name: string; id: string };

type InitialState = {
  activeAccount: Account | null;
  activeWallet: BaseWallet | null;
  activeNetwork: {
    network: NetworkShort;
    sharedChainName: string;
  } | null;
};

const initialState: InitialState = {
  activeAccount: null,
  activeNetwork: null,
  activeWallet: null,
};

export const generalSlice = createSlice({
  name: 'general',
  initialState,
  reducers: {
    changeActiveAccount(
      state,
      action: PayloadAction<{ account: Account; wallet: BaseWallet }>,
    ) {
      const { account, wallet } = action.payload;
      state.activeAccount = account;
      state.activeWallet = wallet;
    },
    changeActiveNetwork(
      state,
      action: PayloadAction<NonNullable<InitialState['activeNetwork']>>,
    ) {
      state.activeNetwork = action.payload;
    },
  },
});

export const { changeActiveAccount, changeActiveNetwork } =
  generalSlice.actions;

export default generalSlice.reducer;
