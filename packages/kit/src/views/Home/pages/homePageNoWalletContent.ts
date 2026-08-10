type IWalletListItemForNoWalletCheck =
  | {
      isMocked?: boolean;
      deprecated?: boolean;
    }
  | undefined;

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

export type IHomePageWalletContentMode = 'noWallet' | 'recovering' | 'wallet';

export function getHomePageWalletContentMode({
  hasNoUsableWallet,
  showNoWalletContent,
  activeDeprecatedWalletCanShowAssets,
}: {
  hasNoUsableWallet: boolean;
  showNoWalletContent: boolean;
  activeDeprecatedWalletCanShowAssets: boolean;
}): IHomePageWalletContentMode {
  if (!hasNoUsableWallet || activeDeprecatedWalletCanShowAssets) {
    return 'wallet';
  }
  if (showNoWalletContent) {
    return 'noWallet';
  }
  return 'recovering';
}
