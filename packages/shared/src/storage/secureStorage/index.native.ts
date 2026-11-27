import { requireOptionalNativeModule } from 'expo';
import {
  WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  canUseBiometricAuthentication,
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
  // Bind secure-store items to this device only so they are excluded from
  // encrypted iTunes/Finder/iCloud backups and never migrate to a new device.
  // iOS-only; ignored on Android.
  keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const setSecureItem = async (
  key: string,
  data: string,
  _options?: ISecureStorageSetOptions,
) => setItemAsync(key, data, keychainOptions);

export const getSecureItem = async (key: string) =>
  getItemAsync(key, keychainOptions);

export const removeSecureItem = async (
  key: string,
  options?: { keychainService?: string },
) => deleteItemAsync(key, { ...keychainOptions, ...options });

const supportSecureStorage = async () => true;

const ANDROID_KEYSTORE_HEALTH_KEYCHAIN_SERVICE =
  'onekey_lse_keystore_health_v1';
const ANDROID_KEYSTORE_HEALTH_PROBE_KEY = 'keystore_health_probe';

const storage: ISecureStorage = {
  setSecureItem,
  getSecureItem,
  async supportSecureStorageWithBiometrics() {
    // SecureStore checks enrolled strong biometrics, including Android Class 3.
    return canUseBiometricAuthentication();
  },
  getSecureItemWithBiometrics(key, options) {
    // Expo enforces the ACL from creation; this option cannot upgrade an old
    // unauthenticated item. Callers must use freshly protected key references.
    return getItemAsync(key, {
      ...keychainOptions,
      ...options,
      requireAuthentication: true,
    });
  },
  removeSecureItem,
  supportSecureStorage,
  async hasSecureItem(key: string): Promise<boolean> {
    const value = await getItemAsync(key, keychainOptions);
    return !!value;
  },
  async hasStoredSecureItem(key) {
    const nativeModule = requireOptionalNativeModule<{
      hasStoredValueWithKeyAsync?: (
        name: string,
        options: typeof keychainOptions,
      ) => Promise<boolean>;
    }>('ExpoSecureStore');
    return nativeModule?.hasStoredValueWithKeyAsync?.(key, keychainOptions);
  },
  async verifySecureStorageOperational(): Promise<boolean> {
    // Use an isolated keychainService so this probe creates/uses its own
    // KeyStore alias and never touches or overwrites the default key_v1 alias.
    const probeOptions = {
      ...keychainOptions,
      keychainService: ANDROID_KEYSTORE_HEALTH_KEYCHAIN_SERVICE,
    };
    const probeValue = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      await setItemAsync(
        ANDROID_KEYSTORE_HEALTH_PROBE_KEY,
        probeValue,
        probeOptions,
      );
      const readBack = await getItemAsync(
        ANDROID_KEYSTORE_HEALTH_PROBE_KEY,
        probeOptions,
      );
      return readBack === probeValue;
    } catch {
      return false;
    } finally {
      await deleteItemAsync(
        ANDROID_KEYSTORE_HEALTH_PROBE_KEY,
        probeOptions,
      ).catch(() => undefined);
    }
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
      ...keychainOptions,
      requireAuthentication: true,
      authenticationPrompt: options?.authenticationPrompt,
      keychainService: options?.keychainService,
    });
  },
};

export default storage;
