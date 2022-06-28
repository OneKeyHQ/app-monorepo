import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { Network } from '@onekeyhq/engine/src/types/network';

import { SwapError, SwapQuote } from '../../views/Swap/typings';
import { Token } from '../typings';

type SwapState = {
  inputTokenNetwork?: Network | null;
  inputToken?: Token;
  outputTokenNetwork?: Network | null;
  outputToken?: Token;
  typedValue: string;
  independentField: 'INPUT' | 'OUTPUT';
  refreshRef: number;
  quote?: SwapQuote;
  quoteTime?: number;
  loading: boolean;
  error?: SwapError;
  selectedNetworkId?: string;
  receivingAddress?: string;
  receivingName?: string;
  swftcSupportedTokens: Record<string, string[]>;
  noSupportCoins: Record<string, Record<string, Record<string, string[]>>>;
};

const initialState: SwapState = {
  inputToken: undefined,
  outputToken: undefined,
  typedValue: '',
  independentField: 'INPUT',
  refreshRef: 0,
  loading: false,
  swftcSupportedTokens: {},
  noSupportCoins: {},
};

export const swapSlice = createSlice({
  name: 'swap',
  initialState,
  reducers: {
    setTypedValue(
      state,
      action: PayloadAction<{
        typedValue: string;
        independentField: 'INPUT' | 'OUTPUT';
      }>,
    ) {
      state.typedValue = action.payload.typedValue;
      state.independentField = action.payload.independentField;
    },
    setInputToken(
      state,
      action: PayloadAction<{ token: Token; network?: Network | null }>,
    ) {
      state.inputToken = action.payload.token;
      state.inputTokenNetwork = action.payload.network;
    },
    setOutputToken(
      state,
      action: PayloadAction<{ token: Token; network?: Network | null }>,
    ) {
      state.outputToken = action.payload.token;
      state.outputTokenNetwork = action.payload.network;
    },
    switchTokens(state) {
      const token = state.inputToken;
      state.inputToken = state.outputToken;
      state.outputToken = token;
      state.independentField =
        state.independentField === 'INPUT' ? 'OUTPUT' : 'INPUT';

      const network = state.inputTokenNetwork;
      state.inputTokenNetwork = state.outputTokenNetwork;
      state.outputTokenNetwork = network;
    },
    reset(state) {
      state.inputToken = undefined;
      state.inputTokenNetwork = undefined;
      state.outputToken = undefined;
      state.outputTokenNetwork = undefined;

      state.independentField = 'INPUT';
      state.typedValue = '';

      state.quote = undefined;
      state.quoteTime = undefined;
      state.loading = false;
      state.error = undefined;
    },
    refresh(state) {
      state.refreshRef += 1;
    },
    setQuote(state, action: PayloadAction<SwapQuote | undefined>) {
      state.quote = action.payload;
      if (action.payload) {
        state.quoteTime = Date.now();
      } else {
        state.quoteTime = undefined;
      }
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<SwapError | undefined>) {
      state.error = action.payload;
    },
    setSelectedNetworkId(state, action: PayloadAction<string | undefined>) {
      state.selectedNetworkId = action.payload;
    },
    setReceiving(
      state,
      action: PayloadAction<{ address: string; name?: string } | undefined>,
    ) {
      state.receivingAddress = action.payload?.address;
      state.receivingName = action.payload?.name;
    },
    setSwftcSupportedTokens(
      state,
      action: PayloadAction<Record<string, string[]>>,
    ) {
      state.swftcSupportedTokens = action.payload;
    },
    setNoSupportCoins(
      state,
      action: PayloadAction<
        Record<string, Record<string, Record<string, string[]>>>
      >,
    ) {
      state.noSupportCoins = action.payload;
    },
  },
});

export const {
  setTypedValue,
  setInputToken,
  setOutputToken,
  switchTokens,
  reset,
  refresh,
  setQuote,
  setLoading,
  setError,
  setSelectedNetworkId,
  setReceiving,
  setSwftcSupportedTokens,
  setNoSupportCoins,
} = swapSlice.actions;

export default swapSlice.reducer;
