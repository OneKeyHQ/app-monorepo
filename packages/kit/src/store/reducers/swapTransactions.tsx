import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { TransactionDetails } from '../../views/Swap/typings';

export type TransactionsState = {
  transactions: Record<string, Record<string, TransactionDetails[]>>;
};

const initialState: TransactionsState = {
  transactions: {},
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
            'status' | 'receipt' | 'swftcReceipt' | 'confirmedTime'
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
        tx.receipt = transaction.receipt;
        tx.confirmedTime = transaction.confirmedTime;
        tx.swftcReceipt = transaction.swftcReceipt;
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
  },
});

export const {
  addTransaction,
  updateTransaction,
  archiveTransaction,
  clearTransactions,
  clearAccountTransactions,
} = swapTransactionsSlice.actions;

export default swapTransactionsSlice.reducer;
