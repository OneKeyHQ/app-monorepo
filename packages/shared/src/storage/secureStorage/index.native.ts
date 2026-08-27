import {
  WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  deleteItemAsync,
  getItemAsync,
  setItemAsync,
} from 'expo-secure-store';

import platformEnv from '../../platformEnv';

import type { ISecureStorage, ISecureStorageSetOptions } from './types';

// On the native background runtime the expo-secure-store native module is an
// inert stub (apps/mobile/background.ts), so keychain operations forward to
// the main thread over the SharedRPC reverse channel installed by
// setupBackgroundThreadRPCHandler. The forwarded methods mirror this module's
// exports one-to-one and execute against the real keychain on main.
type IMainNativeUtilsForwarder = (request: {
  module: 'secureStorage' | 'biologyAuth';
  method: string;
  params?: unknown[];
}) => Promise<unknown>;

const getMainThreadForwarder = (): IMainNativeUtilsForwarder | undefined => {
  if (!platformEnv.isNativeBackgroundThread) {
    return undefined;
  }
  return (
    globalThis as {
      __onekeyCallMainThreadNativeUtils?: IMainNativeUtilsForwarder;
    }
  ).__onekeyCallMainThreadNativeUtils;
};

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
) => {
  const forwarder = getMainThreadForwarder();
  if (forwarder) {
    await forwarder({
      module: 'secureStorage',
      method: 'setSecureItem',
      params: [key, data],
    });
    return;
  }
  await setItemAsync(key, data, keychainOptions);
};

export const getSecureItem = async (key: string) => {
  const forwarder = getMainThreadForwarder();
  if (forwarder) {
    return (await forwarder({
      module: 'secureStorage',
      method: 'getSecureItem',
      params: [key],
    })) as string | null;
  }
  return getItemAsync(key, keychainOptions);
};

export const removeSecureItem = async (key: string) => {
  const forwarder = getMainThreadForwarder();
  if (forwarder) {
    await forwarder({
      module: 'secureStorage',
      method: 'removeSecureItem',
      params: [key],
    });
    return;
  }
  await deleteItemAsync(key, keychainOptions);
};

const supportSecureStorage = async () => true;

const storage: ISecureStorage = {
  setSecureItem,
  getSecureItem,
  removeSecureItem,
  supportSecureStorage,
  async hasSecureItem(key: string): Promise<boolean> {
    const value = await getSecureItem(key);
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
      ...keychainOptions,
      requireAuthentication: true,
      authenticationPrompt: options?.authenticationPrompt,
    });
  },
};

export default storage;
