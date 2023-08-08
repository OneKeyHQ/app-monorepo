import { useEffect, useMemo, useState } from 'react';

import type { Account } from '@onekeyhq/engine/src/types/account';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks/redux';
import {
  selectRuntimeNetworks,
  selectRuntimeWallets,
  selectSwapTransactions,
} from '../../../store/selectors';

import type { TransactionDetails } from '../typings';

export function isTransactionRecent(tx: TransactionDetails): boolean {
  return Date.now() - tx.addedTime < 86400000;
}

export function useAllTransactions(): TransactionDetails[] {
  const transactions = useAppSelector(selectSwapTransactions);
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
  const wallets = useAppSelector(selectRuntimeWallets);
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
  const networks = useAppSelector(selectRuntimeNetworks);
  const networkIds = useMemo(() => networks.map((item) => item.id), [networks]);
  const accountIds = useMemo(
    () => walletsAccounts.map((item) => item.accountId),
    [walletsAccounts],
  );
  return swapTransations.filter(
    (tx) =>
      accountIds.includes(tx.accountId) && networkIds.includes(tx.networkId),
  );
}

export function useTransactionsAccount(accountId?: string, networkId?: string) {
  const walletAccounts = useWalletsAccounts();
  const [account, setAccount] = useState<Account | undefined | null>(() =>
    walletAccounts.find((item) => item.accountId === accountId)
      ? undefined
      : null,
  );

  useEffect(() => {
    const walletAccount = walletAccounts.find(
      (item) => item.accountId === accountId,
    );
    if (walletAccount) {
      backgroundApiProxy.engine
        .getAccounts([walletAccount.accountId], networkId)
        .then(([item]) => {
          if (item) {
            setAccount(item);
          }
        });
    }
  }, [walletAccounts, accountId, networkId]);
  return account;
}
