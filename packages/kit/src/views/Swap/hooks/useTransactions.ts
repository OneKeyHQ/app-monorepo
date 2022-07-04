import { useMemo } from 'react';

import { useAppSelector } from '../../../hooks/redux';
import { TransactionDetails, TransactionType } from '../typings';

export function isTransactionRecent(tx: TransactionDetails): boolean {
  return new Date().getTime() - tx.addedTime < 86400000;
}

export function useAllTransactions(
  accountId: string,
  networkId?: string,
): TransactionDetails[] {
  const transactions = useAppSelector(
    (state) => state.swapTransactions.transactions,
  );
  return useMemo(() => {
    const records = transactions[accountId];
    if (!records) {
      return [];
    }
    if (!networkId) {
      const values = Object.values(records);
      return values.reduce((a, b) => a.concat(b), []);
    }
    return records?.[networkId] ?? [];
  }, [transactions, networkId, accountId]);
}

export function useTransactions(
  accountId: string,
  networkId?: string,
  type: TransactionType = 'swap',
): TransactionDetails[] {
  const transactions = useAllTransactions(accountId, networkId);
  return useMemo(
    () => transactions.filter((tx) => tx.type === type),
    [transactions, type],
  );
}

export function useHasPendingApproval(
  accountId: string,
  networkId: string,
  tokenAddress: string | undefined,
  spender: string | undefined,
): boolean {
  const allTransactions = useTransactions(accountId, networkId, 'approve');
  return useMemo(
    () =>
      typeof tokenAddress === 'string' &&
      typeof spender === 'string' &&
      allTransactions.some((tx) => {
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
