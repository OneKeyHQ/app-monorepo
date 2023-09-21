import { createSlice } from '@reduxjs/toolkit';

import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';

import type {
  FetchQuoteResponse,
  ProgressStatus,
  QuoteData,
  QuoteLimited,
  Recipient,
  SwapError,
} from '../../views/Swap/typings';
import type { PayloadAction } from '@reduxjs/toolkit';

type SwapMode = 'swap' | 'limit';

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

  sendingAccount?: Account | null;
  showMoreQuoteDetail?: boolean;
  userSelectedQuoter?: Record<string, string>;
  responses?: FetchQuoteResponse[];

  allowAnotherRecipientAddress?: boolean;
  progressStatus?: ProgressStatus;
  mode: SwapMode;
};

const initialState: SwapState = {
  inputToken: undefined,
  outputToken: undefined,
  typedValue: '',
  independentField: 'INPUT',
  loading: false,
  mode: 'swap',
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
      state.independentField = 'INPUT';
      // state.independentField =
      //   state.independentField === 'INPUT' ? 'OUTPUT' : 'INPUT';

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
      state.showMoreQuoteDetail = false;
      state.userSelectedQuoter = undefined;
      state.responses = undefined;
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
      state.showMoreQuoteDetail = false;
      state.userSelectedQuoter = undefined;
      state.responses = undefined;
    },
    setQuote(state, action: PayloadAction<QuoteData | undefined>) {
      // SUI Transaction: error TS2589: Type instantiation is excessively deep and possibly infinite.
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
    setSendingAccount(
      state,
      action: PayloadAction<Account | undefined | null>,
    ) {
      state.sendingAccount = action.payload;
    },
    setShowMoreQuoteDetail(state, action: PayloadAction<boolean>) {
      state.showMoreQuoteDetail = action.payload;
    },
    setUserSelectedQuoter(
      state,
      action: PayloadAction<{ hash: string; type: string }>,
    ) {
      if (!state.userSelectedQuoter) {
        state.userSelectedQuoter = {};
      }
      const { hash, type } = action.payload;
      state.userSelectedQuoter[hash] = type;
    },
    clearUserSelectedQuoter(state) {
      state.userSelectedQuoter = undefined;
    },
    setResponses(
      state,
      action: PayloadAction<FetchQuoteResponse[] | undefined>,
    ) {
      state.responses = action.payload;
    },
    setAllowAnotherRecipientAddress(state, action: PayloadAction<boolean>) {
      state.allowAnotherRecipientAddress = action.payload;
    },
    setMode(state, action: PayloadAction<SwapMode>) {
      state.mode = action.payload;
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
  setRecipient,
  setSendingAccount,
  setShowMoreQuoteDetail,
  setUserSelectedQuoter,
  clearUserSelectedQuoter,
  setResponses,
  setAllowAnotherRecipientAddress,
  setProgressStatus,
  setMode,
} = swapSlice.actions;

export default swapSlice.reducer;
