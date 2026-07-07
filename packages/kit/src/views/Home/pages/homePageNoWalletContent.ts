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
}: {
  hasNoUsableWallet: boolean;
  accountSelectorStorageInitDone: boolean;
  accountSelectorActiveAccountInitDone: boolean;
  walletListResolvedNoWallet: boolean;
}) {
  return (
    hasNoUsableWallet &&
    accountSelectorStorageInitDone &&
    accountSelectorActiveAccountInitDone &&
    walletListResolvedNoWallet
  );
}
