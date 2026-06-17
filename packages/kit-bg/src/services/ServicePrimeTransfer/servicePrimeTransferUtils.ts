import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  IPrimeTransferData,
  IPrimeTransferPrivateData,
  IPrimeTransferUnavailableCredential,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';

import {
  type IPortableCredentialInput,
  normalizePortableCredential,
} from '../../dbs/local/localSecretEnvelope';

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

export function normalizePrimeTransferCredential(
  credential: IPortableCredentialInput,
) {
  return normalizePortableCredential({
    credential,
  });
}

// For each credential skipped during transfer-payload build (its local secret
// envelope layer was transiently unavailable), resolve a human label and then
// remove the orphaned wallet/account entry from `privateData` so no wallet or
// account without its credential reaches the receiver.
//
// NOTE: mutates `privateData` (prunes `wallets` / `importedAccounts`). Labels
// are resolved BEFORE pruning. A credentialId maps to one of: an HD wallet id,
// an imported account id, or a TON mnemonic credential id (which is derived
// from an imported account id).
export function collectAndPruneUnavailableTransferCredentials({
  privateData,
  unavailableCredentialIds,
}: {
  privateData: Pick<IPrimeTransferPrivateData, 'wallets' | 'importedAccounts'>;
  unavailableCredentialIds: string[];
}): IPrimeTransferUnavailableCredential[] {
  const unavailableCredentials: IPrimeTransferUnavailableCredential[] =
    unavailableCredentialIds.map((credentialId) => {
      const tonAccountId = accountUtils.isTonMnemonicCredentialId(credentialId)
        ? accountUtils.getAccountIdFromTonMnemonicCredentialId({ credentialId })
        : undefined;
      const label =
        privateData.wallets[credentialId]?.name ||
        privateData.importedAccounts[credentialId]?.name ||
        (tonAccountId
          ? privateData.importedAccounts[tonAccountId]?.name
          : undefined) ||
        credentialId;
      return { credentialId, label };
    });

  for (const credentialId of unavailableCredentialIds) {
    delete privateData.wallets[credentialId];
    delete privateData.importedAccounts[credentialId];
    if (accountUtils.isTonMnemonicCredentialId(credentialId)) {
      delete privateData.importedAccounts[
        accountUtils.getAccountIdFromTonMnemonicCredentialId({ credentialId })
      ];
    }
  }

  return unavailableCredentials;
}
