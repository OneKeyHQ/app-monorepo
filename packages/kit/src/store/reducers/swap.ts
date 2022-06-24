import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { Network } from '@onekeyhq/engine/src/types/network';

import { SwapError, SwapQuote } from '../../views/Swap/typings';
import { Token } from '../typings';

export interface SerializableTransactionReceipt {
  to: string;
  from: string;
  contractAddress: string;
  transactionIndex: number;
  blockHash: string;
  transactionHash: string;
  blockNumber: number;
  status?: string;
}

export interface TransactionDetails {
  hash: string;
  approval?: { tokenAddress: string; spender: string };
  summary?: string;
  claim?: { recipient: string };
  receipt?: SerializableTransactionReceipt;
  lastCheckedBlockNumber?: number;
  addedTime: number;
  confirmedTime?: number;
  from: string;
  orderId?: string;
}

type SwapState = {
  inputTokenNetwork?: Network | null;
  inputToken?: Token;
  outputTokenNetwork?: Network | null;
  outputToken?: Token;
  typedValue: string;
  independentField: 'INPUT' | 'OUTPUT';
  refreshRef: number;
  transactions: {
    [networkid: string]: {
      [txHash: string]: TransactionDetails;
    };
  };
  quote?: SwapQuote;
  quoteTime?: number;
  loading: boolean;
  error?: SwapError;
  activeNetwork?: Network | null;
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
  transactions: {},
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
    addTransaction(
      state,
      action: PayloadAction<{
        networkId: string;
        transaction: TransactionDetails;
      }>,
    ) {
      const { networkId, transaction } = action.payload;
      if (!state.transactions[networkId]) {
        state.transactions[networkId] = {};
      }
      state.transactions[networkId][transaction.hash] = transaction;
    },
    cleanAllTransaction(state, action: PayloadAction<{ networkId: string }>) {
      const { networkId } = action.payload;
      state.transactions[networkId] = {};
    },
    cleanFailedTransactions(
      state,
      action: PayloadAction<{ networkId: string }>,
    ) {
      const { networkId } = action.payload;
      const transactions = state.transactions[networkId] || {};
      const result: { [txHash: string]: TransactionDetails } = {};
      Object.values(transactions).forEach((tx) => {
        if (tx.receipt && Number(tx.receipt.status) !== 1) {
          return;
        }
        result[tx.hash] = tx;
      });
      state.transactions[networkId] = result;
    },
    cleanFulfillTransactions(
      state,
      action: PayloadAction<{ networkId: string }>,
    ) {
      const { networkId } = action.payload;
      const transactions = state.transactions[networkId] || {};
      const result: { [txHash: string]: TransactionDetails } = {};
      Object.values(transactions).forEach((tx) => {
        if (tx.receipt && Number(tx.receipt.status) === 1) {
          return;
        }
        result[tx.hash] = tx;
      });
      state.transactions[networkId] = result;
    },
    cleanAllConfirmedTransaction(
      state,
      action: PayloadAction<{ networkId: string }>,
    ) {
      const { networkId } = action.payload;
      const transactions = state.transactions[networkId] || {};
      const result: { [txHash: string]: TransactionDetails } = {};
      Object.values(transactions).forEach((tx) => {
        if (!tx.confirmedTime) {
          result[tx.hash] = tx;
        }
      });
      state.transactions[networkId] = result;
    },
    finalizeTransaction(
      state,
      action: PayloadAction<{
        networkId: string;
        hash: string;
        confirmedTime: number;
        receipt?: SerializableTransactionReceipt;
      }>,
    ) {
      const { networkId, hash, confirmedTime, receipt } = action.payload;
      const tx = state.transactions[networkId]?.[hash];
      if (!tx) {
        return;
      }
      tx.receipt = receipt;
      tx.confirmedTime = confirmedTime;
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
    setActiveNetwork(state, action: PayloadAction<Network>) {
      state.activeNetwork = action.payload;
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
  addTransaction,
  cleanAllTransaction,
  cleanFulfillTransactions,
  cleanFailedTransactions,
  finalizeTransaction,
  setQuote,
  setLoading,
  setError,
  setActiveNetwork,
  setReceiving,
  setSwftcSupportedTokens,
  setNoSupportCoins,
} = swapSlice.actions;

export default swapSlice.reducer;
