type IWalletListItemForNoWalletCheck =
  | {
      id?: string;
      isMocked?: boolean;
      deprecated?: boolean;
    }
  | undefined;

export type IHomeWalletContentReadiness = 'pending' | 'wallet' | 'no-wallet';

export function isWalletListResolvedNoWallet({
  wallets,
}: {
  wallets: IWalletListItemForNoWalletCheck[] | undefined;
}) {
  if (!wallets) {
    return false;
  }
  return wallets.every((wallet) => !!(wallet?.isMocked || wallet?.deprecated));
}

export function shouldShowNoWalletContent({
  hasNoUsableWallet,
  accountSelectorStorageInitDone,
  accountSelectorActiveAccountInitDone,
  walletListResolvedNoWallet,
  activeWalletUnavailable,
  activeWalletId,
  walletListWalletIds,
}: {
  hasNoUsableWallet: boolean;
  accountSelectorStorageInitDone: boolean;
  accountSelectorActiveAccountInitDone: boolean;
  walletListResolvedNoWallet: boolean;
  activeWalletUnavailable?: boolean;
  activeWalletId?: string;
  walletListWalletIds?: string[];
}) {
  const walletListResolvedCurrentUnusableWalletOnly =
    !!activeWalletId &&
    !!walletListWalletIds &&
    walletListWalletIds.length === 1 &&
    walletListWalletIds[0] === activeWalletId;

  return (
    hasNoUsableWallet &&
    accountSelectorStorageInitDone &&
    accountSelectorActiveAccountInitDone &&
    (walletListResolvedNoWallet ||
      (!!activeWalletUnavailable &&
        walletListResolvedCurrentUnusableWalletOnly))
  );
}

export function resolveHomeWalletContentReadiness({
  walletListPending,
  wallets,
  hasNoUsableWallet,
  accountSelectorStorageInitDone,
  accountSelectorActiveAccountInitDone,
  activeAccountReady,
  activeWalletUnavailable,
  activeWalletId,
}: {
  walletListPending: boolean;
  wallets: IWalletListItemForNoWalletCheck[] | undefined;
  hasNoUsableWallet: boolean;
  accountSelectorStorageInitDone: boolean;
  accountSelectorActiveAccountInitDone: boolean;
  activeAccountReady: boolean;
  activeWalletUnavailable?: boolean;
  activeWalletId?: string;
}): IHomeWalletContentReadiness {
  if (
    walletListPending ||
    !wallets ||
    !accountSelectorStorageInitDone ||
    !accountSelectorActiveAccountInitDone ||
    !activeAccountReady
  ) {
    return 'pending';
  }

  const walletListWalletIds = wallets.flatMap((wallet) =>
    wallet && 'id' in wallet && typeof wallet.id === 'string'
      ? [wallet.id]
      : [],
  );
  const walletListResolvedNoWallet = isWalletListResolvedNoWallet({ wallets });
  if (
    shouldShowNoWalletContent({
      hasNoUsableWallet,
      accountSelectorStorageInitDone,
      accountSelectorActiveAccountInitDone,
      walletListResolvedNoWallet,
      activeWalletUnavailable,
      activeWalletId,
      walletListWalletIds,
    })
  ) {
    return 'no-wallet';
  }

  if (
    !hasNoUsableWallet &&
    !!activeWalletId &&
    walletListWalletIds.includes(activeWalletId)
  ) {
    return 'wallet';
  }
  return 'pending';
}
