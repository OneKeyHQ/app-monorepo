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

  return wallets.filter(
    (wallet) =>
      !wallet.isKeyless &&
      (!allowedWalletIds || allowedWalletIds.has(wallet.id)),
  );
}

export function shouldUseCliTransportDecryptedCredentials({
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
    walletIds.length === 1 &&
    importedAccountIds.length === 0 &&
    watchingAccountIds.length === 0 &&
    accountUtils.isBotWallet({ walletId: walletIds[0] })
  );
}
