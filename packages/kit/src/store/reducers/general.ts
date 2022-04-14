import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import type { Token } from '@onekeyhq/engine/src/types/token';

export type ValuedToken = Token & { balance?: string };

export type GeneralInitialState = {
  activeAccountId: string | null;
  activeWalletId: string | null;
  activeNetworkId: string | null;
  tokens: Record<string, Record<string, Token[]>>;
  ownedTokens: Record<string, Record<string, ValuedToken[]>>;
  tokensPrice: Record<string, Record<string, string>>;
};

const initialState: GeneralInitialState = {
  activeAccountId: null,
  activeNetworkId: null,
  activeWalletId: null,
  tokens: {},
  ownedTokens: {},
  tokensPrice: {},
} as const;

export const generalSlice = createSlice({
  name: 'general',
  initialState,
  reducers: {
    setActiveIds(
      state,
      action: PayloadAction<
        Pick<
          GeneralInitialState,
          'activeAccountId' | 'activeNetworkId' | 'activeWalletId'
        >
      >,
    ) {
      const { activeAccountId, activeNetworkId, activeWalletId } =
        action.payload;
      state.activeAccountId = activeAccountId;
      state.activeWalletId = activeWalletId;
      state.activeNetworkId = activeNetworkId;
    },
    changeActiveAccount(
      state,
      action: PayloadAction<
        Pick<GeneralInitialState, 'activeAccountId' | 'activeWalletId'>
      >,
    ) {
      const { activeAccountId, activeWalletId } = action.payload;
      state.activeAccountId = activeAccountId;
      state.activeWalletId = activeWalletId;
    },
    changeActiveNetwork(
      state,
      action: PayloadAction<
        NonNullable<GeneralInitialState['activeNetworkId']>
      >,
    ) {
      state.activeNetworkId = action.payload;
    },
    changeActiveTokens(state, action: PayloadAction<Token[]>) {
      const { activeAccountId, activeNetworkId } = state;
      if (activeAccountId && activeNetworkId) {
        if (!state.tokens[activeAccountId]) {
          state.tokens[activeAccountId] = {};
        }
        state.tokens[activeAccountId][activeNetworkId] = action.payload;
      }
    },
    changeActiveOwnedToken(state, action: PayloadAction<ValuedToken[]>) {
      const { activeAccountId, activeNetworkId } = state;
      if (activeAccountId && activeNetworkId) {
        if (!state.ownedTokens[activeAccountId]) {
          state.ownedTokens[activeAccountId] = {};
        }
        state.ownedTokens[activeAccountId][activeNetworkId] = action.payload;
      }
    },
    updateTokensPrice(state, action: PayloadAction<Record<string, string>>) {
      const { activeNetworkId } = state;
      if (activeNetworkId) {
        const oldState = state.tokensPrice[activeNetworkId];
        state.tokensPrice[activeNetworkId] = {
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
  updateTokensPrice,
  changeActiveAccount,
  changeActiveNetwork,
  setActiveIds,
} = generalSlice.actions;

export default generalSlice.reducer;
