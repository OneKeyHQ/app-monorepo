import { useCallback, useMemo } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount, useAppSelector } from '../../../hooks/redux';
import {
  SerializableTransactionReceipt,
  TransactionDetails,
  addTransaction,
  cleanFailedTransactions,
  cleanFulfillTransactions,
  finalizeTransaction,
} from '../../../store/reducers/swap';

const now = () => new Date().getTime();

// helper that can take a ethers library transaction response and add it to the list of transactions
export function useTransactionAdder(): (response: {
  hash: string;
  summary?: string;
  orderId?: string;
  approval?: { tokenAddress: string; spender: string };
}) => void {
  const { networkId, account } = useActiveWalletAccount();
  return useCallback(
    (response: {
      hash: string;
      summary?: string;
      orderId?: string;
      approval?: { tokenAddress: string; spender: string };
    }) => {
      if (!account) return;
      if (!networkId) return;
      const { hash, summary, approval, orderId } = response;
      if (!hash) {
        throw Error('No transaction hash found.');
      }
      backgroundApiProxy.dispatch(
        addTransaction({
          networkId,
          transaction: {
            hash,
            from: account.address,
            approval,
            summary,
            orderId,
            addedTime: now(),
          },
        }),
      );
    },
    [networkId, account],
  );
}

export function useFinalizeTransaction() {
  const { networkId } = useActiveWalletAccount();
  return useCallback(
    (hash: string, receipt?: SerializableTransactionReceipt) => {
      if (networkId) {
        backgroundApiProxy.dispatch(
          finalizeTransaction({
            networkId,
            hash,
            confirmedTime: now(),
            receipt,
          }),
        );
      }
    },
    [networkId],
  );
}

export function useCleanFailedTransactions() {
  const { networkId } = useActiveWalletAccount();
  return useCallback(() => {
    if (networkId) {
      backgroundApiProxy.dispatch(cleanFailedTransactions({ networkId }));
    }
  }, [networkId]);
}

export function useCleanFulfilledTransactions() {
  const { networkId } = useActiveWalletAccount();
  return useCallback(() => {
    if (networkId) {
      backgroundApiProxy.dispatch(cleanFulfillTransactions({ networkId }));
    }
  }, [networkId]);
}

/**
 * Returns whether a transaction happened in the last day (86400 seconds * 1000 milliseconds / second)
 * @param tx to check for recency
 */
export function isTransactionRecent(tx: TransactionDetails): boolean {
  return new Date().getTime() - tx.addedTime < 86400000;
}

export function useAllTransactions(): { [txHash: string]: TransactionDetails } {
  const { networkId } = useActiveWalletAccount();
  const transactions = useAppSelector((state) => state.swap.transactions);
  return transactions[networkId] ?? {};
}

// returns whether a token has a pending approval transaction
export function useHasPendingApproval(
  tokenAddress: string | undefined,
  spender: string | undefined,
): boolean {
  const allTransactions = useAllTransactions();
  return useMemo(
    () =>
      typeof tokenAddress === 'string' &&
      typeof spender === 'string' &&
      Object.keys(allTransactions).some((hash) => {
        const tx = allTransactions[hash];
        if (!tx) return false;
        const { approval, confirmedTime } = tx;
        if (!approval || confirmedTime) return false;
        return (
          approval.spender === spender &&
          approval.tokenAddress === tokenAddress &&
          isTransactionRecent(tx)
        );
      }),
    [allTransactions, spender, tokenAddress],
  );
}
