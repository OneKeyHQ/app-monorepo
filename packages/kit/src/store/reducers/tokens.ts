import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import type { Token } from '@onekeyhq/engine/src/types/token';

export type TokenBalanceValue = string | undefined;

export type TokenInitialState = {
  tokens: Record<string, Token[]>;
  tokensPrice: Record<string, Record<string, string>>;
  accountTokens: Record<string, Record<string, Token[]>>;
  accountTokensBalance: Record<
    string,
    Record<string, Record<string, TokenBalanceValue>>
  >;
};

const initialState: TokenInitialState = {
  tokens: {},
  tokensPrice: {},
  accountTokens: {},
  accountTokensBalance: {},
} as const;

type TokenPayloadAction = {
  activeAccountId?: string | null;
  activeNetworkId?: string | null;
  tokens: Token[];
};

type PricePayloadAction = {
  activeNetworkId?: string | null;
  prices: Record<string, string>;
};

type TokenBalancePayloadAction = {
  activeAccountId?: string | null;
  activeNetworkId?: string | null;
  tokensBalance: Record<string, string | undefined>;
};

export const tokensSlice = createSlice({
  name: 'tokens',
  initialState,
  reducers: {
    setTokens(state, action: PayloadAction<TokenPayloadAction>) {
      const { activeNetworkId, tokens } = action.payload;
      if (!activeNetworkId) {
        return;
      }
      state.tokens[activeNetworkId] = tokens;
    },
    setPrices(state, action: PayloadAction<PricePayloadAction>) {
      const { activeNetworkId, prices } = action.payload;
      if (!activeNetworkId) {
        return;
      }
      const oldPrices = state.tokensPrice[activeNetworkId] || {};
      state.tokensPrice[activeNetworkId] = { ...oldPrices, ...prices };
    },
    setAccountTokens(state, action: PayloadAction<TokenPayloadAction>) {
      const { activeAccountId, activeNetworkId, tokens } = action.payload;
      if (!activeAccountId || !activeNetworkId) {
        return;
      }
      if (!state.accountTokens[activeNetworkId]) {
        state.accountTokens[activeNetworkId] = {};
      }
      state.accountTokens[activeNetworkId][activeAccountId] = tokens;
    },
    setAccountTokensBalances(
      state,
      action: PayloadAction<TokenBalancePayloadAction>,
    ) {
      const { activeAccountId, activeNetworkId, tokensBalance } =
        action.payload;
      if (!activeAccountId || !activeNetworkId) {
        return;
      }
      if (!state.accountTokensBalance[activeNetworkId]) {
        state.accountTokensBalance[activeNetworkId] = {};
      }
      const oldTokensBalance =
        state.accountTokensBalance[activeNetworkId][activeAccountId] || {};
      state.accountTokensBalance[activeNetworkId][activeAccountId] = {
        ...oldTokensBalance,
        ...tokensBalance,
      };
    },
  },
});

export const {
  setTokens,
  setPrices,
  setAccountTokens,
  setAccountTokensBalances,
} = tokensSlice.actions;
export default tokensSlice.reducer;
