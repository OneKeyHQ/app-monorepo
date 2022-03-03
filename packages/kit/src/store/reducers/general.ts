import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { Dispatch } from 'redux';

import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';

import type { Network } from './network';

export type ValuedToken = Token & { balance?: string };

export type GeneralInitialState = {
  activeAccount: Account | null;
  activeWallet: Wallet | null;
  activeNetwork: {
    network: Network;
    sharedChainName: string;
  } | null;
  tokens: Record<string, Record<string, Token[]>>;
  ownedTokens: Record<string, Record<string, ValuedToken[]>>;
  tokensPrice: Record<string, Record<string, string>>;
  isRuntimeUnlock: boolean;
};

const initialState: GeneralInitialState = {
  activeAccount: null,
  activeNetwork: null,
  activeWallet: null,
  tokens: {},
  ownedTokens: {},
  tokensPrice: {},
  // eslint-disable-next-line
  isRuntimeUnlock: __DEV__, // isUnlock is in memory, so when app was killed/reload, it will be reset to false
};

export const generalSlice = createSlice({
  name: 'general',
  initialState,
  reducers: {
    $changeActiveAccount(
      state,
      action: PayloadAction<{ account: Account | null; wallet: Wallet | null }>,
    ) {
      const { account, wallet } = action.payload;
      state.activeAccount = account;
      state.activeWallet = wallet;
    },
    $changeActiveNetwork(
      state,
      action: PayloadAction<NonNullable<GeneralInitialState['activeNetwork']>>,
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
    changeActiveOwnedToken(state, action: PayloadAction<ValuedToken[]>) {
      const { activeAccount, activeNetwork } = state;
      if (activeAccount && activeNetwork) {
        if (!state.ownedTokens[activeAccount.id]) {
          state.ownedTokens[activeAccount.id] = {};
        }
        state.ownedTokens[activeAccount.id][activeNetwork?.network.id] =
          action.payload;
      }
    },
    runtimeUnlock(state) {
      state.isRuntimeUnlock = true;
    },
    updateTokensPrice(state, action: PayloadAction<Record<string, string>>) {
      const { activeNetwork } = state;
      if (activeNetwork) {
        const oldState = state.tokensPrice[activeNetwork?.network.id];
        state.tokensPrice[activeNetwork?.network.id] = {
          ...oldState,
          ...action.payload,
        };
      }
    },
  },
});

export const {
  changeActiveTokens,
  changeActiveOwnedToken,
  runtimeUnlock,
  updateTokensPrice,
} = generalSlice.actions;

const { $changeActiveAccount, $changeActiveNetwork } = generalSlice.actions;

export const changeActiveAccount =
  (state: { account: Account | null; wallet: Wallet | null }) =>
  async (dispatch: Dispatch) => {
    dispatch($changeActiveAccount(state));
    // use global var to avoid cycle-deps
    global.$backgroundApiProxy.notifyAccountsChanged();
    return Promise.resolve();
  };

export const changeActiveNetwork =
  (state: NonNullable<GeneralInitialState['activeNetwork']>) =>
  async (dispatch: Dispatch) => {
    dispatch($changeActiveNetwork(state));
    global.$backgroundApiProxy.notifyChainChanged();
    return Promise.resolve();
  };

export default generalSlice.reducer;
