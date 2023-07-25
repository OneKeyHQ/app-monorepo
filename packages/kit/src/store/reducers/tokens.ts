import { createSlice } from '@reduxjs/toolkit';
import stringify from 'fast-json-stable-stringify';
import { uniqBy } from 'lodash';

import type { Token } from '@onekeyhq/engine/src/types/token';

import type { PayloadAction } from '@reduxjs/toolkit';

export type IAmountValue = string | IValueLoading | IValueNull;
export type TokenBalanceValue =
  | {
      balance: string;
      availableBalance?: string;
      transferBalance?: string;
      blockHeight?: string;
    }
  | IValueLoading
  | IValueNull;
export type ITokenBalanceInfo = {
  balance: IAmountValue;
  blockHeight?: string;
};
export type TokenChartData = [number, number][];
export const CValueLoading = undefined;
export const CValueNull = null;
export type IValueLoading = typeof CValueLoading;
export type IValueNull = typeof CValueNull;
export type ITokenPriceValue = number | IValueLoading | IValueNull;
export type SimpleTokenPrices = Record<string, ITokenPriceValue>;
export type ITokensPricesMap = Record<PriceId, SimpleTokenPrices>;
export type ITokenPriceInfo = {
  priceKey?: string;
  priceRawInfo?: SimpleTokenPrices;
  price: ITokenPriceValue;
  price24h: ITokenPriceValue;
};

type NetworkId = string;
type AccountId = string;
type TokenId = string;
type PriceId = string; // networkid-contractAddress

export type SimplifiedToken = {
  tokenIdOnNetwork: string;
  sendAddress?: string;
  autoDetected?: boolean;
};

export type IAccountTokensBalanceMap = Record<TokenId, TokenBalanceValue>;
export type TokenInitialState = {
  tokenPriceMap: ITokensPricesMap;
  accountTokens: Record<NetworkId, Record<AccountId, Token[]>>;
  accountTokensBalance: Record<
    NetworkId,
    Record<AccountId, IAccountTokensBalanceMap>
  >;
};

const initialState: TokenInitialState = {
  tokenPriceMap: {},
  accountTokens: {},
  accountTokensBalance: {},
} as const;

type TokenPayloadAction = {
  accountId?: string | null;
  networkId?: string | null;
  tokens: Token[];
};

type TokenBalancePayloadAction = {
  accountId?: string | null;
  networkId?: string | null;
  tokensBalance: Record<string, TokenBalanceValue>;
};

type TokenPrivePayloadAction = {
  prices: Record<string, SimpleTokenPrices>;
  vsCurrency: string;
};

export const tokensSlice = createSlice({
  name: 'tokens',
  initialState,
  reducers: {
    setTokenPriceMap(state, action: PayloadAction<TokenPrivePayloadAction>) {
      const { prices, vsCurrency } = action.payload;
      if (!state.tokenPriceMap) state.tokenPriceMap = {};
      Object.keys(prices).forEach((key) => {
        const cachePrice = state.tokenPriceMap[key] || {};

        // The content is not updated at any time if it has not changed
        if (
          stringify(cachePrice[vsCurrency]) !==
          stringify(prices[key][vsCurrency])
        ) {
          state.tokenPriceMap[key] = {
            ...cachePrice,
            ...prices[key],
            [`updatedAt--${vsCurrency}`]: Date.now(),
          };
        }
      });
    },
    setAccountTokens(state, action: PayloadAction<TokenPayloadAction>) {
      const { accountId, networkId, tokens } = action.payload;
      if (!accountId || !networkId) {
        return;
      }
      if (!state.accountTokens[networkId]) {
        state.accountTokens[networkId] = {};
      }
      state.accountTokens[networkId][accountId] = uniqBy(
        tokens.filter((t, _i, arr) => {
          if (
            !t.sendAddress &&
            arr.some(
              (token) => token.sendAddress && token.address === t.address,
            )
          ) {
            return false;
          }
          if (
            t.autoDetected &&
            arr.some(
              (token) => !token.autoDetected && token.address === t.address,
            )
          ) {
            return false;
          }
          return true;
        }),
        (t) => `${t.tokenIdOnNetwork}-${t.sendAddress ?? ''}`,
      );
    },
    setAccountTokensBalances(
      state,
      action: PayloadAction<TokenBalancePayloadAction>,
    ) {
      const { accountId, networkId, tokensBalance } = action.payload;
      if (!accountId || !networkId) {
        return;
      }
      if (!state.accountTokensBalance[networkId]) {
        state.accountTokensBalance[networkId] = {};
      }
      const oldTokensBalance =
        state.accountTokensBalance[networkId][accountId] || {};
      // native token balance defaults to 0
      oldTokensBalance.main = oldTokensBalance.main ?? {
        balance: '0',
      };

      state.accountTokensBalance[networkId][accountId] = {
        ...oldTokensBalance,
        ...tokensBalance,
      };
    },
  },
});

export const { setTokenPriceMap, setAccountTokens, setAccountTokensBalances } =
  tokensSlice.actions;
export default tokensSlice.reducer;
