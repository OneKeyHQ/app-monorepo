import { createSlice } from '@reduxjs/toolkit';

import type { Token } from '@onekeyhq/engine/src/types/token';

import type {
  ISlippageSetting,
  TransactionDetails,
} from '../../views/Swap/typings';
import type { PayloadAction } from '@reduxjs/toolkit';

export type TokenListItem = {
  name: string;
  networkId: string;
  logoURI: string;
  tokens: Token[];
};

export type IssueToken = {
  networkId: string;
  address: string;
};

export type TransactionsState = {
  transactions: Record<string, Record<string, TransactionDetails[]>>;
  tokenList?: TokenListItem[];
  swapMaintain?: boolean;
  swapChartMode?: string;
  swapFeePresetIndex?: string;
  slippage?: ISlippageSetting;
  coingeckoIds?: { popular?: string[]; stable?: string[] };
  recommendedSlippage?: {
    popular?: string;
    stable?: string;
    others?: string;
  };
  wrapperTokens?: Record<string, string>;
  approvalIssueTokens?: IssueToken[];
  payments?: Record<string, Token>;
  defaultPayment?: Token;
  reservedNetworkFees?: Record<string, string>;
};

const initialState: TransactionsState = {
  transactions: {},
  swapFeePresetIndex: '1',
};

export const swapTransactionsSlice = createSlice({
  name: 'swapTransactions',
  initialState,
  reducers: {
    addTransaction(
      state,
      action: PayloadAction<{
        accountId: string;
        networkId: string;
        transaction: TransactionDetails;
      }>,
    ) {
      const { accountId, networkId, transaction } = action.payload;
      if (!state.transactions[accountId]) {
        state.transactions[accountId] = {};
      }
      const oldTransactions = state.transactions[accountId][networkId] ?? [];
      const newTransactions = [transaction, ...oldTransactions];
      if (newTransactions.length > 30) {
        newTransactions.length = 30;
      }
      state.transactions[accountId][networkId] = newTransactions;
    },
    updateTransaction(
      state,
      action: PayloadAction<{
        accountId: string;
        networkId: string;
        hash: string;
        transaction: Partial<
          Pick<
            TransactionDetails,
            | 'status'
            | 'confirmedTime'
            | 'destinationTransactionHash'
            | 'networkFee'
            | 'actualReceived'
          >
        >;
      }>,
    ) {
      const { accountId, networkId, hash, transaction } = action.payload;
      const transactions = state.transactions[accountId]?.[networkId];
      const tx = transactions.filter((item) => item.hash === hash)[0];
      if (tx) {
        if (transaction.status) {
          tx.status = transaction.status;
        }
        if (transaction.confirmedTime) {
          tx.confirmedTime = transaction.confirmedTime;
        }
        if (transaction.destinationTransactionHash) {
          tx.destinationTransactionHash =
            transaction.destinationTransactionHash;
        }
        if (transaction.networkFee) {
          tx.networkFee = transaction.networkFee;
        }
        if (transaction.actualReceived) {
          tx.actualReceived = transaction.actualReceived;
        }
      }
    },
    archiveTransaction(
      state,
      action: PayloadAction<{
        accountId: string;
        networkId: string;
        txs: string[];
      }>,
    ) {
      const { accountId, networkId, txs } = action.payload;
      const transactions = state.transactions[accountId]?.[networkId];
      transactions.forEach((tx) => {
        if (txs.includes(tx.hash)) {
          tx.archive = true;
        }
      });
    },
    clearTransactions(state) {
      state.transactions = {};
    },
    clearAccountTransactions(
      state,
      action: PayloadAction<{ accountId: string }>,
    ) {
      const { accountId } = action.payload;
      state.transactions[accountId] = {};
    },
    updateTokenList(state, action: PayloadAction<TokenListItem[]>) {
      state.tokenList = action.payload;
    },
    setSwapMaintain(state, action: PayloadAction<boolean>) {
      state.swapMaintain = action.payload;
    },
    setSwapChartMode(state, action: PayloadAction<string>) {
      state.swapChartMode = action.payload;
    },
    setSwapFeePresetIndex(state, action: PayloadAction<string>) {
      state.swapFeePresetIndex = action.payload;
    },
    setSlippage(state, action: PayloadAction<ISlippageSetting>) {
      state.slippage = action.payload;
    },
    setCoingeckoIds(
      state,
      action: PayloadAction<{ popular?: string[]; stable?: string[] }>,
    ) {
      state.coingeckoIds = action.payload;
    },
    setRecommendedSlippage(
      state,
      action: PayloadAction<{
        popular?: string;
        stable?: string;
        others: string;
      }>,
    ) {
      state.recommendedSlippage = action.payload;
    },
    setWrapperTokens(state, action: PayloadAction<Record<string, string>>) {
      state.wrapperTokens = action.payload;
    },
    setApprovalIssueTokens(state, action: PayloadAction<IssueToken[]>) {
      state.approvalIssueTokens = action.payload;
    },
    setPayments(state, action: PayloadAction<Record<string, Token>>) {
      state.payments = action.payload;
    },
    setDefaultPayment(state, action: PayloadAction<Token>) {
      state.defaultPayment = action.payload;
    },
    setReservedNetworkFees(
      state,
      action: PayloadAction<Record<string, string>>,
    ) {
      state.reservedNetworkFees = action.payload;
    },
  },
});

export const {
  addTransaction,
  updateTransaction,
  archiveTransaction,
  clearTransactions,
  clearAccountTransactions,
  updateTokenList,
  setSwapMaintain,
  setSwapChartMode,
  setSwapFeePresetIndex,
  setSlippage,
  setCoingeckoIds,
  setRecommendedSlippage,
  setWrapperTokens,
  setApprovalIssueTokens,
  setPayments,
  setDefaultPayment,
  setReservedNetworkFees,
} = swapTransactionsSlice.actions;

export default swapTransactionsSlice.reducer;
