import {
  WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  deleteItemAsync,
  getItemAsync,
  setItemAsync,
} from 'expo-secure-store';

import type { ISecureStorage, ISecureStorageSetOptions } from './types';

// TODO use custom keychain service for keyless wallet device key pack
// default is 'app:no-auth', 'app:auth'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const KEYCHAIN_SERVICE = 'Onekey Wallet Secure Store';

const keychainOptions = {
  // keychainService: KEYCHAIN_SERVICE,
};

// Options applied when WRITING secrets to secure storage.
//
// keychainAccessible is iOS-only (ignored on Android, which already binds
// keystore keys to the device). WHEN_UNLOCKED_THIS_DEVICE_ONLY maps to
// kSecAttrAccessibleWhenUnlockedThisDeviceOnly, which is identical to the
// default WHEN_UNLOCKED while the item lives on its original device, but
// additionally EXCLUDES the item from encrypted iTunes/Finder/iCloud backups
// so it can never be migrated to another device on restore.
//
// This keeps device-bound secrets (cached unlock password, keyless-wallet
// secrets, and any keychain-resident wrapping key) from being carried
// off-device together with the encrypted local database, preserving the
// two-factor isolation between the on-disk ciphertext and the keychain key.
//
// NOTE: keychainAccessible only takes effect for newly written items. Items
// written before this change keep their previous accessibility until they are
// next re-written (e.g. the next savePassword).
const keychainWriteOptions = {
  ...keychainOptions,
  keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const setSecureItem = async (
  key: string,
  data: string,
  _options?: ISecureStorageSetOptions,
) => setItemAsync(key, data, keychainWriteOptions);

export const getSecureItem = async (key: string) =>
  getItemAsync(key, keychainOptions);

export const removeSecureItem = async (key: string) =>
  deleteItemAsync(key, keychainOptions);

const supportSecureStorage = async () => true;

const storage: ISecureStorage = {
  setSecureItem,
  getSecureItem,
  removeSecureItem,
  supportSecureStorage,
  async hasSecureItem(key: string): Promise<boolean> {
    const value = await getItemAsync(key, keychainOptions);
    return !!value;
  },
  async getCredentialId(): Promise<string | null> {
    return null;
  },
  async resetForPasskeyReEnroll(): Promise<void> {
    return undefined;
  },
  async supportSecureStorageWithoutInteraction(): Promise<boolean> {
    return supportSecureStorage();
  },
  setSecureItemWithBiometrics(key, data, options) {
    return setItemAsync(key, data, {
      ...keychainWriteOptions,
      requireAuthentication: true,
      authenticationPrompt: options?.authenticationPrompt,
    });
  },
};

export default storage;
