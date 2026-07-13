import {
  KeychainStorage,
  LinuxSecureStorage,
  MacOSSecureStorage,
} from '../../../infra/keychain-storage';
import {
  KEYCHAIN_PASSPHRASE_STATE_KEY,
  KEYCHAIN_SESSION_ID_KEY,
} from '../../../signer/keychain-keys';

export type ILegacyKeychainStorage = Pick<KeychainStorage, 'delete'>;

export const LEGACY_MNEMONIC_ACCOUNT = 'wallet:default/mnemonic';
export const LEGACY_ENCRYPTION_KEY_ACCOUNT = 'wallet:default/encryption-key';

export const LEGACY_KEYCHAIN_ACCOUNTS = [
  LEGACY_MNEMONIC_ACCOUNT,
  LEGACY_ENCRYPTION_KEY_ACCOUNT,
  KEYCHAIN_PASSPHRASE_STATE_KEY,
  KEYCHAIN_SESSION_ID_KEY,
] as const;

export function createLegacyKeychainStorage(
  platform: NodeJS.Platform = process.platform,
): ILegacyKeychainStorage | null {
  if (platform === 'darwin') {
    return new KeychainStorage(new MacOSSecureStorage());
  }
  if (platform === 'linux') {
    return new KeychainStorage(new LinuxSecureStorage());
  }
  return null;
}

export function resolveLegacyKeychainStorage({
  currentWasInjected,
  legacyKeychainStorage,
}: {
  currentWasInjected: boolean;
  legacyKeychainStorage?: ILegacyKeychainStorage | null;
}): ILegacyKeychainStorage | null {
  if (legacyKeychainStorage !== undefined) {
    return legacyKeychainStorage;
  }
  if (currentWasInjected) {
    return null;
  }
  return createLegacyKeychainStorage();
}

async function deleteLegacyAccount({
  account,
  storage,
  warn,
}: {
  account: string;
  storage: ILegacyKeychainStorage;
  warn: (message: string, error?: unknown) => void;
}): Promise<void> {
  try {
    await storage.delete(account);
  } catch (error) {
    warn(`Failed to delete ${account}`, error);
  }
}

export async function deleteLegacyKeychainAccounts({
  currentKeychainStorage,
  legacyKeychainStorage,
  warn,
}: {
  currentKeychainStorage: ILegacyKeychainStorage;
  legacyKeychainStorage?: ILegacyKeychainStorage | null;
  warn: (message: string, error?: unknown) => void;
}): Promise<void> {
  for (const account of LEGACY_KEYCHAIN_ACCOUNTS) {
    await deleteLegacyAccount({
      account,
      storage: currentKeychainStorage,
      warn,
    });

    if (
      legacyKeychainStorage &&
      legacyKeychainStorage !== currentKeychainStorage
    ) {
      await deleteLegacyAccount({
        account,
        storage: legacyKeychainStorage,
        warn,
      });
    }
  }
}
