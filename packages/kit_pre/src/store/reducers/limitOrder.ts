import { createSlice } from '@reduxjs/toolkit';

import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Token } from '@onekeyhq/engine/src/types/token';

import type { ProgressStatus, TypedPrice } from '../../views/Swap/typings';
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
  typedPrice: TypedPrice;
  progressStatus?: ProgressStatus;
};

const initialState: LimitOrderState = {
  tokenIn: undefined,
  tokenOut: undefined,
  typedValue: '',
  expireIn: 10080,
  instantRate: '',
  mktRate: '',
  typedPrice: {
    value: '',
  },
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
      state.typedPrice = { reversed: false, value: '' };
      state.loading = false;
    },
    setExpireIn(state, action: PayloadAction<number>) {
      state.expireIn = action.payload;
    },
    setTypedPrice(state, action: PayloadAction<TypedPrice>) {
      state.typedPrice = action.payload;
    },
    setProgressStatus(
      state,
      action: PayloadAction<ProgressStatus | undefined>,
    ) {
      state.progressStatus = action.payload;
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
  setTypedPrice,
  setProgressStatus,
} = limitOrderSlice.actions;

export default limitOrderSlice.reducer;
