import { useEffect, useMemo, useState } from 'react';

import type { Account } from '@onekeyhq/engine/src/types/account';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks/redux';

import type { TransactionDetails } from '../typings';

export function isTransactionRecent(tx: TransactionDetails): boolean {
  return new Date().getTime() - tx.addedTime < 86400000;
}

export function useAllTransactions(): TransactionDetails[] {
  const transactions = useAppSelector(
    (state) => state.swapTransactions.transactions,
  );
  return useMemo(() => {
    const accountsTransactions = Object.values(transactions);
    const txs = accountsTransactions.reduce(
      (result, item) => result.concat(...Object.values(item)),
      [] as TransactionDetails[],
    );
    return [...txs].sort((a, b) => (a.addedTime > b.addedTime ? -1 : 1));
  }, [transactions]);
}

function useSwapTransactions(): TransactionDetails[] {
  const transactions = useAllTransactions();
  return useMemo(
    () => transactions.filter((tx) => tx.type === 'swap'),
    [transactions],
  );
}

export function useWalletsAccounts() {
  const wallets = useAppSelector((s) => s.runtime.wallets);
  return useMemo(
    () =>
      wallets.reduce(
        (result, wallet) =>
          result.concat(
            wallet.accounts.map((account) => ({
              accountId: account,
              walletId: wallet.id,
            })),
          ),
        [] as { accountId: string; walletId: string }[],
      ),
    [wallets],
  );
}

export function useWalletsSwapTransactions() {
  const swapTransations = useSwapTransactions();
  const walletsAccounts = useWalletsAccounts();
  const networks = useAppSelector((s) => s.runtime.networks);
  const networkIds = useMemo(() => networks.map((item) => item.id), [networks]);
  const accountIds = useMemo(
    () => walletsAccounts.map((item) => item.accountId),
    [walletsAccounts],
  );
  const accountIdsSet = new Set(accountIds);
  const networkIdsSet = new Set(networkIds);
  return swapTransations.filter(
    (tx) => accountIdsSet.has(tx.accountId) && networkIdsSet.has(tx.networkId),
  );
}

export function useTransactionsAccount(accountId: string) {
  const walletAccounts = useWalletsAccounts();
  const [account, setAccount] = useState<Account | undefined | null>(() =>
    walletAccounts.find((item) => item.accountId === accountId)
      ? undefined
      : null,
  );

  useEffect(() => {
    async function main() {
      const walletAccount = walletAccounts.find(
        (item) => item.accountId === accountId,
      );
      if (walletAccount) {
        const [item] = await backgroundApiProxy.engine.getAccounts([
          walletAccount.accountId,
        ]);
        if (item) {
          setAccount(item);
        }
      }
    }
    main();
  }, [walletAccounts, accountId]);
  return account;
}
