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
  | 'active-wallet'
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
  activeWalletOwnerReady,
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
  activeWalletOwnerReady?: boolean;
  activeWalletUnavailable?: boolean;
  activeWalletId?: string;
}): IHomeWalletContentReadiness {
  const walletListWalletIds = wallets?.flatMap((wallet) =>
    wallet && 'id' in wallet && typeof wallet.id === 'string'
      ? [wallet.id]
      : [],
  );
  const walletListRejectsActiveOwner =
    !!activeWalletId &&
    !!walletListWalletIds &&
    !walletListWalletIds.includes(activeWalletId);
  const canRenderCachedWallet =
    !!cachedWalletOwnerReady &&
    activeAccountReady &&
    !hasNoUsableWallet &&
    !activeWalletUnavailable &&
    !!activeWalletId &&
    !walletListRejectsActiveOwner;
  const canRenderActiveWallet =
    !!activeWalletOwnerReady &&
    activeAccountReady &&
    !hasNoUsableWallet &&
    !activeWalletUnavailable &&
    !!activeWalletId &&
    !walletListRejectsActiveOwner;

  if (
    walletListPending ||
    !wallets ||
    !accountSelectorStorageInitDone ||
    !accountSelectorActiveAccountInitDone ||
    !activeAccountReady
  ) {
    if (canRenderCachedWallet) {
      return 'cached-wallet';
    }
    return canRenderActiveWallet ? 'active-wallet' : 'pending';
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
    return canRenderActiveWallet ? 'wallet' : 'pending';
  }
  return 'pending';
}
