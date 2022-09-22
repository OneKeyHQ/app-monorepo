import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { Network } from '@onekeyhq/engine/src/types/network';
import { Token } from '@onekeyhq/engine/src/types/token';

import {
  QuoteData,
  QuoteLimited,
  Recipient,
  SwapError,
} from '../../views/Swap/typings';

type SwapState = {
  inputTokenNetwork?: Network | null;
  inputToken?: Token;
  outputTokenNetwork?: Network | null;
  outputToken?: Token;
  typedValue: string;
  independentField: 'INPUT' | 'OUTPUT';
  quote?: QuoteData;
  quoteLimited?: QuoteLimited;
  quoteTime?: number;
  loading: boolean;
  error?: SwapError;

  recipient?: Recipient;

  receivingNetworkId?: string;
  sendingNetworkId?: string;
};

const initialState: SwapState = {
  inputToken: undefined,
  outputToken: undefined,
  typedValue: '',
  independentField: 'INPUT',
  loading: false,
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
    },
    resetTypedValue(state) {
      state.typedValue = '';
    },
    clearState(state) {
      state.independentField = 'INPUT';
      state.typedValue = '';
      state.quote = undefined;
      state.quoteTime = undefined;
      state.error = undefined;
      state.quoteLimited = undefined;
      state.recipient = undefined;
    },
    resetState(state) {
      state.inputToken = undefined;
      state.inputTokenNetwork = undefined;
      state.outputToken = undefined;
      state.outputTokenNetwork = undefined;
      state.independentField = 'INPUT';

      state.typedValue = '';
      state.recipient = undefined;

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
    setRecipient(state, action: PayloadAction<Recipient | undefined>) {
      state.recipient = action.payload;
    },
    setReceivingNetworkId(state, action: PayloadAction<string | undefined>) {
      state.receivingNetworkId = action.payload;
    },
    setSendingNetworkId(state, action: PayloadAction<string | undefined>) {
      state.sendingNetworkId = action.payload;
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
  resetTypedValue,
  clearState,
  resetState,
  setReceivingNetworkId,
  setSendingNetworkId,
  setRecipient,
} = swapSlice.actions;

export default swapSlice.reducer;
