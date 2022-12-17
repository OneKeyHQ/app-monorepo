import { createSlice } from '@reduxjs/toolkit';
import { merge } from 'lodash';

import type { Token } from '@onekeyhq/engine/src/types/token';

import type { PayloadAction } from '@reduxjs/toolkit';

export type TokenBalanceValue = string | undefined;
export type TokenChartData = [number, number][];

export type PriceLoading = undefined;
export type NoPriceData = null;
export type TokenPrices = Record<TokenId, string | PriceLoading | NoPriceData>;
export type SimpleTokenPrices = Record<
  string,
  number | PriceLoading | NoPriceData
>;

type NetworkId = string;
type AccountId = string;
type TokenId = string;
type PriceId = string; // networkid-contractAddress

export type TokenInitialState = {
  tokens: Record<NetworkId, Token[]>;
  tokenPriceMap: Record<PriceId, SimpleTokenPrices>;
  tokensPrice: Partial<Record<NetworkId, TokenPrices>>;
  charts: Record<NetworkId, Record<TokenId, TokenChartData>>;
  accountTokens: Record<NetworkId, Record<TokenId, Token[]>>;
  accountTokensBalance: Record<
    NetworkId,
    Record<AccountId, Record<TokenId, TokenBalanceValue>>
  >;
  nativeTokens?: Record<NetworkId, Token>;
  enabledNativeTokens?: Token[];
};

const initialState: TokenInitialState = {
  tokens: {},
  tokenPriceMap: {},
  nativeTokens: {},
  tokensPrice: {},
  accountTokens: {},
  accountTokensBalance: {},
  charts: {},
  enabledNativeTokens: [] as Token[],
} as const;

type TokenPayloadAction = {
  activeAccountId?: string | null;
  activeNetworkId?: string | null;
  tokens: Token[];
};

type PricePayloadAction = {
  activeNetworkId?: string | null;
  prices: TokenPrices;
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

type TokenPrivePayloadAction = {
  prices: Record<string, SimpleTokenPrices>;
};

export const tokensSlice = createSlice({
  name: 'tokens',
  initialState,
  reducers: {
    addNetworkTokens(state, action: PayloadAction<TokenPayloadAction>) {
      const { activeNetworkId, tokens } = action.payload;
      if (!activeNetworkId) {
        return;
      }
      const mergedTokens = tokens.concat(state.tokens[activeNetworkId] || []);
      const tokenIds: string[] = [];
      const dedupedTokens = mergedTokens.filter((token) => {
        if (tokenIds.includes(token.tokenIdOnNetwork)) {
          return false;
        }
        tokenIds.push(token.tokenIdOnNetwork);
        return true;
      });
      state.tokens[activeNetworkId] = dedupedTokens;
    },
    setNetworkTokens(
      state,
      action: PayloadAction<
        TokenPayloadAction & {
          keepAutoDetected?: boolean;
        }
      >,
    ) {
      const { activeNetworkId, tokens, keepAutoDetected } = action.payload;
      if (!activeNetworkId) {
        return;
      }
      if (keepAutoDetected) {
        const autoDetectedTokens =
          state.tokens[activeNetworkId]?.filter(
            (oldToken) =>
              oldToken.autoDetected &&
              !tokens.find(
                (newToken) =>
                  newToken.tokenIdOnNetwork === oldToken.tokenIdOnNetwork,
              ),
          ) || [];
        state.tokens[activeNetworkId] = tokens.concat(autoDetectedTokens);
      } else {
        state.tokens[activeNetworkId] = tokens;
      }
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
    setTokenPriceMap(state, action: PayloadAction<TokenPrivePayloadAction>) {
      const { prices } = action.payload;
      Object.keys(prices).forEach((key) => {
        if (!state.tokenPriceMap) state.tokenPriceMap = {};
        const cachePrice = state.tokenPriceMap[key] || {};
        state.tokenPriceMap[key] = { ...cachePrice, ...prices[key] };
      });
      // check old data
      if (Object.keys(state.tokensPrice).length) {
        state.tokensPrice = {};
      }
      if (Object.keys(state.charts).length) {
        state.charts = {};
      }
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
    addAccountTokens(state, action: PayloadAction<TokenPayloadAction>) {
      const { activeAccountId, activeNetworkId, tokens } = action.payload;
      if (!activeAccountId || !activeNetworkId) {
        return;
      }
      if (!state.accountTokens[activeNetworkId]) {
        state.accountTokens[activeNetworkId] = {};
      }
      const mergedTokens = tokens.concat(
        state.accountTokens[activeNetworkId][activeAccountId] || [],
      );
      const tokenIds: string[] = [];
      const dedupedTokens = mergedTokens.filter((token) => {
        if (tokenIds.includes(token.tokenIdOnNetwork)) {
          return false;
        }
        tokenIds.push(token.tokenIdOnNetwork);
        return true;
      });
      state.accountTokens[activeNetworkId][activeAccountId] = dedupedTokens;
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
    setNativeToken(
      state,
      action: PayloadAction<{ networkId: string; token: Token }>,
    ) {
      const { networkId, token } = action.payload;
      if (!state.nativeTokens) {
        state.nativeTokens = {};
      }
      state.nativeTokens[networkId] = token;
    },
    setEnabledNativeTokens(state, action: PayloadAction<Token[]>) {
      state.enabledNativeTokens = action.payload;
    },
  },
});

export const {
  addNetworkTokens,
  setNetworkTokens,
  setPrices,
  setTokenPriceMap,
  setCharts,
  setAccountTokens,
  setAccountTokensBalances,
  addAccountTokens,
  setNativeToken,
  setEnabledNativeTokens,
} = tokensSlice.actions;
export default tokensSlice.reducer;
