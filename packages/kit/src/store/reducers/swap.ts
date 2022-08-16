import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { Network } from '@onekeyhq/engine/src/types/network';
import { Token } from '@onekeyhq/engine/src/types/token';

import { QuoteData, QuoteLimited, SwapError } from '../../views/Swap/typings';

type SwapState = {
  inputTokenNetwork?: Network | null;
  inputToken?: Token;
  outputTokenNetwork?: Network | null;
  outputToken?: Token;
  typedValue: string;
  independentField: 'INPUT' | 'OUTPUT';
  refreshRef: number;
  quote?: QuoteData;
  quoteLimited?: QuoteLimited;
  quoteTime?: number;
  loading: boolean;
  error?: SwapError;
  selectedNetworkId?: string;
  receivingAddress?: string;
  receivingName?: string;
  swftcSupportedTokens: Record<string, string[]>;
  approvalSubmitted?: boolean;
};

const initialState: SwapState = {
  inputToken: undefined,
  outputToken: undefined,
  typedValue: '',
  independentField: 'INPUT',
  refreshRef: 0,
  loading: false,
  swftcSupportedTokens: {},
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
      action: PayloadAction<{ token?: Token; network?: Network | null }>,
    ) {
      state.inputToken = action.payload.token;
      state.inputTokenNetwork = action.payload.network;
    },
    setOutputToken(
      state,
      action: PayloadAction<{ token?: Token; network?: Network | null }>,
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
      state.approvalSubmitted = false;
    },
    resetTypedValue(state) {
      state.typedValue = '';
    },
    clearState(state) {
      state.independentField = 'INPUT';
      state.typedValue = '';
      state.receivingAddress = undefined;
      state.receivingName = undefined;
      state.quote = undefined;
      state.quoteTime = undefined;
      state.error = undefined;
      state.quoteLimited = undefined;
    },
    resetState(state) {
      state.inputToken = undefined;
      state.inputTokenNetwork = undefined;
      state.outputToken = undefined;
      state.outputTokenNetwork = undefined;
      state.independentField = 'INPUT';

      state.typedValue = '';
      state.receivingAddress = undefined;
      state.receivingName = undefined;
      state.quote = undefined;
      state.quoteTime = undefined;
      state.loading = false;
      state.error = undefined;
      state.quoteLimited = undefined;
    },
    setQuote(state, action: PayloadAction<QuoteData | undefined>) {
      state.quote = action.payload;
    },
    setQuoteTime(state, action: PayloadAction<number | undefined>) {
      state.quoteTime = action.payload;
    },
    setQuoteLimited(state, action: PayloadAction<QuoteLimited | undefined>) {
      state.quoteLimited = action.payload;
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
      action: PayloadAction<{ address?: string; name?: string } | undefined>,
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
    setApprovalSubmitted(state, action: PayloadAction<boolean>) {
      state.approvalSubmitted = action.payload;
    },
  },
});

export const {
  setTypedValue,
  setInputToken,
  setOutputToken,
  switchTokens,
  setQuote,
  setQuoteTime,
  setQuoteLimited,
  setLoading,
  setError,
  setSelectedNetworkId,
  setReceiving,
  setSwftcSupportedTokens,
  setApprovalSubmitted,
  resetTypedValue,
  clearState,
  resetState,
} = swapSlice.actions;

export default swapSlice.reducer;
