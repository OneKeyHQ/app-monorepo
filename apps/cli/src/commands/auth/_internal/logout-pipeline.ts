import fs from 'node:fs/promises';

import { secureCache } from '../../../core';
import { KeychainStorage } from '../../../infra/keychain-storage';
import {
  MASTER_KEY_ACCOUNT,
  REVOKE_TIMEOUT_MS,
  VAULT_FILE,
  VAULT_LOCK,
  VaultClient,
  revokeBotWalletKey,
} from '../../../infra/vault';

import {
  deleteLegacyKeychainAccounts,
  resolveLegacyKeychainStorage,
} from './legacy-keychain-cleanup';

export {
  LEGACY_ENCRYPTION_KEY_ACCOUNT,
  LEGACY_KEYCHAIN_ACCOUNTS,
  LEGACY_MNEMONIC_ACCOUNT,
} from './legacy-keychain-cleanup';

type ILogoutRecord = {
  keyId: string;
  accessToken: string;
};

type IKeychainStorageLike = Pick<KeychainStorage, 'delete'>;

export type ILogoutPipelineDependencies = {
  vaultClient?: Pick<VaultClient, 'atomicMutate' | 'readOnly'>;
  keychainStorage?: IKeychainStorageLike;
  legacyKeychainStorage?: IKeychainStorageLike | null;
  readVaultRecords?: () => Promise<ILogoutRecord[]>;
  revokeKey?: (record: ILogoutRecord, signal: AbortSignal) => Promise<void>;
  unlink?: (filePath: string) => Promise<void>;
  clearSecureCache?: () => void;
  warn?: (message: string, error?: unknown) => void;
  revokeTimeoutMs?: number;
  masterKeyAccount?: string;
  vaultFile?: string;
  vaultLock?: string;
};

function isIgnorableReadError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'VAULT_MISSING' || error.code === 'NOT_AUTHENTICATED')
  );
}

async function unlinkIfExists(
  unlink: (filePath: string) => Promise<void>,
  filePath: string,
): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return;
    }
    throw error;
  }
}

async function revokeWithTimeout({
  record,
  revokeKey,
  warn,
  timeoutMs,
}: {
  record: ILogoutRecord;
  revokeKey: (record: ILogoutRecord, signal: AbortSignal) => Promise<void>;
  warn: (message: string, error?: unknown) => void;
  timeoutMs: number;
}): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    await Promise.race([
      revokeKey(record, controller.signal),
      new Promise<void>((resolve) => {
        controller.signal.addEventListener('abort', () => resolve(), {
          once: true,
        });
      }),
    ]);
  } catch (error) {
    warn(`Failed to revoke key ${record.keyId}`, error);
  } finally {
    clearTimeout(timeout);
  }
}

async function performLogoutCleanup({
  clearSecureCache,
  deleteVaultLock,
  keychainStorage,
  legacyKeychainStorage,
  masterKeyAccount,
  records,
  revokeKey,
  revokeTimeoutMs,
  unlink,
  vaultFile,
  vaultLock,
  warn,
}: {
  clearSecureCache: () => void;
  deleteVaultLock: boolean;
  keychainStorage: IKeychainStorageLike;
  legacyKeychainStorage?: IKeychainStorageLike | null;
  masterKeyAccount: string;
  records: ILogoutRecord[];
  revokeKey: (record: ILogoutRecord, signal: AbortSignal) => Promise<void>;
  revokeTimeoutMs: number;
  unlink: (filePath: string) => Promise<void>;
  vaultFile: string;
  vaultLock: string;
  warn: (message: string, error?: unknown) => void;
}): Promise<void> {
  for (const record of records) {
    await revokeWithTimeout({
      record,
      revokeKey,
      warn,
      timeoutMs: revokeTimeoutMs,
    });
  }

  await keychainStorage.delete(masterKeyAccount);
  await unlinkIfExists(unlink, vaultFile);
  if (deleteVaultLock) {
    await unlinkIfExists(unlink, vaultLock);
  }

  await deleteLegacyKeychainAccounts({
    currentKeychainStorage: keychainStorage,
    legacyKeychainStorage,
    warn,
  });

  clearSecureCache();
}

export async function executeLogoutPipeline(
  dependencies: ILogoutPipelineDependencies = {},
): Promise<void> {
  const vaultClient = dependencies.vaultClient ?? new VaultClient();
  const keychainStorage = dependencies.keychainStorage ?? new KeychainStorage();
  const legacyKeychainStorage = resolveLegacyKeychainStorage({
    currentWasInjected: Boolean(dependencies.keychainStorage),
    legacyKeychainStorage: dependencies.legacyKeychainStorage,
  });
  const readVaultRecords =
    dependencies.readVaultRecords ??
    (async () =>
      vaultClient.readOnly((vault) =>
        Object.entries(vault.records).map(([keyId, record]) => ({
          keyId,
          accessToken: record.accessToken,
        })),
      ));
  const revokeKey =
    dependencies.revokeKey ??
    ((record: ILogoutRecord, signal: AbortSignal) =>
      revokeBotWalletKey({
        accessToken: record.accessToken,
        keyId: record.keyId,
        signal,
      }));
  const unlink = dependencies.unlink ?? fs.unlink;
  const clearSecureCache =
    dependencies.clearSecureCache ?? (() => secureCache.clearAll());
  const warn = dependencies.warn ?? (() => undefined);
  const masterKeyAccount = dependencies.masterKeyAccount ?? MASTER_KEY_ACCOUNT;
  const vaultFile = dependencies.vaultFile ?? VAULT_FILE;
  const vaultLock = dependencies.vaultLock ?? VAULT_LOCK;
  const revokeTimeoutMs = dependencies.revokeTimeoutMs ?? REVOKE_TIMEOUT_MS;

  if (!dependencies.readVaultRecords) {
    try {
      await vaultClient.atomicMutate(async (vault) => {
        await performLogoutCleanup({
          clearSecureCache,
          deleteVaultLock: false,
          keychainStorage,
          legacyKeychainStorage,
          masterKeyAccount,
          records: Object.entries(vault.records).map(([keyId, record]) => ({
            keyId,
            accessToken: record.accessToken,
          })),
          revokeKey,
          revokeTimeoutMs,
          unlink,
          vaultFile,
          vaultLock,
          warn,
        });
        return {
          nextVault: vault,
          result: undefined,
          shouldWrite: false,
        };
      });
      await unlinkIfExists(unlink, vaultLock);
      return;
    } catch (error) {
      if (!isIgnorableReadError(error)) {
        throw error;
      }
      await performLogoutCleanup({
        clearSecureCache,
        deleteVaultLock: true,
        keychainStorage,
        legacyKeychainStorage,
        masterKeyAccount,
        records: [],
        revokeKey,
        revokeTimeoutMs,
        unlink,
        vaultFile,
        vaultLock,
        warn,
      });
      return;
    }
  }

  let records: ILogoutRecord[] = [];
  try {
    records = await readVaultRecords();
  } catch (error) {
    if (!isIgnorableReadError(error)) {
      throw error;
    }
  }

  await performLogoutCleanup({
    clearSecureCache,
    deleteVaultLock: true,
    keychainStorage,
    legacyKeychainStorage,
    masterKeyAccount,
    records,
    revokeKey,
    revokeTimeoutMs,
    unlink,
    vaultFile,
    vaultLock,
    warn,
  });
}
