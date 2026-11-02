import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';

type IHomeTokenListRequestOwner = {
  epoch: number;
  accountId?: string;
  indexedAccountId?: string;
  networkId?: string;
  walletId?: string;
};

type IHomeTokenListActiveAccount = {
  account?: { id: string };
  indexedAccount?: { id: string };
  network?: { id: string };
  wallet?: { id: string };
};

export function isHomeTokenListRequestOwnerCurrent({
  owner,
  currentEpoch,
  activeAccount,
  selectedAccount,
}: {
  owner: IHomeTokenListRequestOwner;
  currentEpoch: number;
  activeAccount: IHomeTokenListActiveAccount | undefined;
  selectedAccount: Partial<IAccountSelectorSelectedAccount> | undefined;
}): boolean {
  if (
    !owner.accountId ||
    !owner.networkId ||
    !owner.walletId ||
    owner.epoch !== currentEpoch ||
    activeAccount?.account?.id !== owner.accountId ||
    activeAccount?.indexedAccount?.id !== owner.indexedAccountId ||
    activeAccount?.network?.id !== owner.networkId ||
    activeAccount?.wallet?.id !== owner.walletId
  ) {
    return false;
  }

  // Selection advances before the background RPC resolves the new active
  // account. A render in that interval must not lend the new epoch to the old
  // account. Default/network-only selections deliberately retain the cached
  // active account during startup, so they do not establish a new owner.
  if (
    !selectedAccount?.walletId &&
    !selectedAccount?.indexedAccountId &&
    !selectedAccount?.othersWalletAccountId
  ) {
    return true;
  }

  return (
    selectedAccount.walletId === owner.walletId &&
    selectedAccount.networkId === owner.networkId &&
    selectedAccount.indexedAccountId === owner.indexedAccountId &&
    (!selectedAccount.othersWalletAccountId ||
      selectedAccount.othersWalletAccountId === owner.accountId)
  );
}
