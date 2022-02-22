import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';

import type { Network } from './network';

export type MyToken = Token & { balance?: string };

type InitialState = {
  activeAccount: Account | null;
  activeWallet: Wallet | null;
  activeNetwork: {
    network: Network;
    sharedChainName: string;
  } | null;
  tokens: Record<string, Record<string, Token[]>>;
  ownedTokens: Record<string, Record<string, MyToken[]>>;
};

const initialState: InitialState = {
  activeAccount: null,
  activeNetwork: null,
  activeWallet: null,
  tokens: {},
  ownedTokens: {},
};

export const generalSlice = createSlice({
  name: 'general',
  initialState,
  reducers: {
    changeActiveAccount(
      state,
      action: PayloadAction<{ account: Account | null; wallet: Wallet }>,
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
    changeActiveTokens(state, action: PayloadAction<Token[]>) {
      const { activeAccount, activeNetwork } = state;
      if (activeAccount && activeNetwork) {
        if (!state.tokens[activeAccount.id]) {
          state.tokens[activeAccount.id] = {};
        }
        state.tokens[activeAccount.id][activeNetwork?.network.id] =
          action.payload;
      }
    },
    changeActiveOwnedToken(state, action: PayloadAction<MyToken[]>) {
      const { activeAccount, activeNetwork } = state;
      if (activeAccount && activeNetwork) {
        if (!state.ownedTokens[activeAccount.id]) {
          state.ownedTokens[activeAccount.id] = {};
        }
        state.ownedTokens[activeAccount.id][activeNetwork?.network.id] =
          action.payload;
      }
    },
  },
});

export const {
  changeActiveAccount,
  changeActiveNetwork,
  changeActiveTokens,
  changeActiveOwnedToken,
} = generalSlice.actions;

export default generalSlice.reducer;
