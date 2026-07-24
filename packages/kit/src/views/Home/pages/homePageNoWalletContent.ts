type IWalletListItemForNoWalletCheck =
  | {
      id?: string;
      isMocked?: boolean;
      deprecated?: boolean;
    }
  | undefined;

export type IHomeWalletContentReadiness =
  | 'pending'
  | 'cached-wallet'
  | 'wallet'
  | 'no-wallet';

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
  cachedWalletOwnerReady,
  confirmedWalletDisplayReady = true,
  activeWalletUnavailable,
  activeWalletId,
}: {
  walletListPending: boolean;
  wallets: IWalletListItemForNoWalletCheck[] | undefined;
  hasNoUsableWallet: boolean;
  accountSelectorStorageInitDone: boolean;
  accountSelectorActiveAccountInitDone: boolean;
  activeAccountReady: boolean;
  cachedWalletOwnerReady?: boolean;
  confirmedWalletDisplayReady?: boolean;
  activeWalletUnavailable?: boolean;
  activeWalletId?: string;
}): IHomeWalletContentReadiness {
  const walletListWalletIds = wallets?.flatMap((wallet) =>
    wallet && 'id' in wallet && typeof wallet.id === 'string'
      ? [wallet.id]
      : [],
  );
  const walletListRejectsCachedOwner =
    !!activeWalletId &&
    !!walletListWalletIds &&
    !walletListWalletIds.includes(activeWalletId);
  const canRenderCachedWallet =
    !!cachedWalletOwnerReady &&
    activeAccountReady &&
    !hasNoUsableWallet &&
    !activeWalletUnavailable &&
    !!activeWalletId &&
    !walletListRejectsCachedOwner;

  if (
    walletListPending ||
    !wallets ||
    !accountSelectorStorageInitDone ||
    !accountSelectorActiveAccountInitDone ||
    !activeAccountReady
  ) {
    return canRenderCachedWallet ? 'cached-wallet' : 'pending';
  }

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
    (walletListWalletIds ?? []).includes(activeWalletId)
  ) {
    return confirmedWalletDisplayReady ? 'wallet' : 'pending';
  }
  return 'pending';
}
