import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import type { IDBWallet } from '../../dbs/local/types';

export function filterTransferWallets({
  wallets,
  walletIds,
}: {
  wallets: IDBWallet[];
  walletIds?: string[];
}) {
  const allowedWalletIds =
    walletIds && walletIds.length ? new Set(walletIds) : undefined;

  return wallets.filter((wallet) => {
    if (wallet.isKeyless) {
      return false;
    }
    // OK-53569: Bot Wallets are excluded from the default "transfer all"
    // path used by App-to-App Prime Transfer and iCloud backup. They are
    // only kept when the caller explicitly requests them by ID, e.g. the
    // Bot Wallet → CLI export flow.
    if (
      !allowedWalletIds &&
      accountUtils.isBotWallet({ walletId: wallet.id })
    ) {
      return false;
    }
    return !allowedWalletIds || allowedWalletIds.has(wallet.id);
  });
}

export function shouldUseCliBotWalletEncryptedCredential({
  transferData,
  allowCliImportableCredentials,
}: {
  transferData: IPrimeTransferData;
  allowCliImportableCredentials?: boolean;
}) {
  if (
    !allowCliImportableCredentials ||
    transferData.isWatchingOnly ||
    transferData.privateData.deviceKeyPack
  ) {
    return false;
  }

  const walletIds = Object.keys(transferData.privateData.wallets ?? {});
  const importedAccountIds = Object.keys(
    transferData.privateData.importedAccounts ?? {},
  );
  const watchingAccountIds = Object.keys(
    transferData.privateData.watchingAccounts ?? {},
  );

  return (
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    getCliBotWalletTransferWalletId({ transferData }) !== undefined &&
    walletIds.length === 1 &&
    importedAccountIds.length === 0 &&
    watchingAccountIds.length === 0
  );
}

export function getCliBotWalletTransferWalletId({
  transferData,
}: {
  transferData: IPrimeTransferData;
}) {
  const walletIds = Object.keys(transferData.privateData.wallets ?? {});
  if (walletIds.length !== 1) {
    return undefined;
  }
  const [walletId] = walletIds;
  return accountUtils.isBotWallet({ walletId }) ? walletId : undefined;
}
