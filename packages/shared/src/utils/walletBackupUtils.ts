import accountUtils from './accountUtils';

export function filterBackupWallets<
  T extends { id: string; isKeyless?: boolean },
>({ wallets, walletIds }: { wallets: T[]; walletIds?: string[] }): T[] {
  const allowedWalletIds =
    walletIds && walletIds.length ? new Set(walletIds) : undefined;

  return wallets.filter((wallet) => {
    if (
      wallet.isKeyless ||
      accountUtils.isKeylessWallet({ walletId: wallet.id })
    ) {
      return false;
    }
    // Bot wallets require an explicit selection, such as the CLI export flow.
    if (
      !allowedWalletIds &&
      accountUtils.isBotWallet({ walletId: wallet.id })
    ) {
      return false;
    }
    return !allowedWalletIds || allowedWalletIds.has(wallet.id);
  });
}
