import { createSlice } from '@reduxjs/toolkit';

import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Token } from '@onekeyhq/engine/src/types/token';

import type { PayloadAction } from '@reduxjs/toolkit';

type LimitOrderState = {
  tokenIn?: Token;
  tokenOut?: Token;
  typedValue: string;
  activeAccount?: Account | null;
  loading?: boolean;
  expireIn: number;
  instantRate: string;
  mktRate: string;
};

const initialState: LimitOrderState = {
  tokenIn: undefined,
  tokenOut: undefined,
  typedValue: '',
  expireIn: 10080,
  instantRate: '',
  mktRate: '',
};

export const limitOrderSlice = createSlice({
  name: 'limitOrder',
  initialState,
  reducers: {
    setTokenIn(state, action: PayloadAction<Token | undefined>) {
      state.tokenIn = action.payload;
    },
    setTokenOut(state, action: PayloadAction<Token | undefined>) {
      state.tokenOut = action.payload;
    },
    setTypedValue(state, action: PayloadAction<string>) {
      state.typedValue = action.payload;
    },
    setActiveAccount(state, action: PayloadAction<Account | undefined | null>) {
      state.activeAccount = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setMktRate(state, action: PayloadAction<string>) {
      state.mktRate = action.payload;
    },
    setInstantRate(state, action: PayloadAction<string>) {
      state.instantRate = action.payload;
    },
    resetState(state) {
      state.typedValue = '';
      state.mktRate = '';
      state.instantRate = '';
    },
    setExpireIn(state, action: PayloadAction<number>) {
      state.expireIn = action.payload;
    },
  },
});

export const {
  setTokenIn,
  setTokenOut,
  setTypedValue,
  setActiveAccount,
  setLoading,
  setInstantRate,
  setMktRate,
  resetState,
  setExpireIn,
} = limitOrderSlice.actions;

export default limitOrderSlice.reducer;
