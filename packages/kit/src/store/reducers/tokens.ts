import { createSlice } from '@reduxjs/toolkit';
import { merge, uniqBy } from 'lodash';

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

export type SimplifiedToken = {
  tokenIdOnNetwork: string;
  sendAddress?: string;
  autoDetected?: boolean;
};

export type TokenInitialState = {
  tokens: Record<NetworkId, Token[]>;
  tokenPriceMap: Record<PriceId, SimpleTokenPrices>;
  accountTokens: Record<NetworkId, Record<TokenId, SimplifiedToken[]>>;
  accountTokensBalance: Record<
    NetworkId,
    Record<AccountId, Record<TokenId, TokenBalanceValue>>
  >;
};

const initialState: TokenInitialState = {
  tokens: {},
  tokenPriceMap: {},
  accountTokens: {},
  accountTokensBalance: {},
} as const;

type TokenPayloadAction = {
  activeAccountId?: string | null;
  activeNetworkId?: string | null;
  tokens: SimplifiedToken[];
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
    setTokenPriceMap(state, action: PayloadAction<TokenPrivePayloadAction>) {
      const { prices } = action.payload;
      Object.keys(prices).forEach((key) => {
        if (!state.tokenPriceMap) state.tokenPriceMap = {};
        const cachePrice = state.tokenPriceMap[key] || {};
        state.tokenPriceMap[key] = { ...cachePrice, ...prices[key] };
      });
    },
    setAccountTokens(state, action: PayloadAction<TokenPayloadAction>) {
      const { activeAccountId, activeNetworkId, tokens } = action.payload;
      if (!activeAccountId || !activeNetworkId) {
        return;
      }
      if (!state.accountTokens[activeNetworkId]) {
        state.accountTokens[activeNetworkId] = {};
      }
      state.accountTokens[activeNetworkId][activeAccountId] = uniqBy(
        tokens,
        (t) => t.tokenIdOnNetwork,
      );
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

export const { setTokenPriceMap, setAccountTokens, setAccountTokensBalances } =
  tokensSlice.actions;
export default tokensSlice.reducer;
