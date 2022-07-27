import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { merge } from 'lodash';

import type { Token } from '@onekeyhq/engine/src/types/token';

export type TokenBalanceValue = string | undefined;
export type TokenChartData = [number, number][];

export type TokenInitialState = {
  tokens: Record<string, Token[]>;
  tokensPrice: Record<string, Record<string, string>>;
  charts: Record<string, Record<string, TokenChartData>>;
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
  charts: {},
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

type ChartPayloadAction = {
  activeNetworkId?: string | null;
  charts: Record<string, TokenChartData>;
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
    setCharts(state, action: PayloadAction<ChartPayloadAction>) {
      const { activeNetworkId, charts } = action.payload;
      if (!activeNetworkId) {
        return;
      }
      state.charts = state.charts || {};
      const oldCharts = state.charts[activeNetworkId] || {};
      state.charts[activeNetworkId] = { ...oldCharts, ...charts };
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
      // native token balance defaults to 0
      oldTokensBalance.main = oldTokensBalance.main ?? '0';

      // use merge() to ignore undefined field updating in tokensBalance
      state.accountTokensBalance[activeNetworkId][activeAccountId] = merge(
        {},
        oldTokensBalance,
        tokensBalance,
      );
    },
  },
});

export const {
  setTokens,
  setPrices,
  setCharts,
  setAccountTokens,
  setAccountTokensBalances,
} = tokensSlice.actions;
export default tokensSlice.reducer;
