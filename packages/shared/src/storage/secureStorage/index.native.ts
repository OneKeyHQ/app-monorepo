import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';

import type { ISecureStorage } from './types';

// TODO use custom keychain service for keyless wallet device key pack
// default is 'app:no-auth', 'app:auth'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const KEYCHAIN_SERVICE = 'Onekey Wallet Secure Store';

const keychainOptions = {
  // keychainService: KEYCHAIN_SERVICE,
};

export const setSecureItem = async (key: string, data: string) =>
  setItemAsync(key, data, keychainOptions);

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
  setSecureItemWithBiometrics(key, data, options) {
    return setItemAsync(key, data, {
      ...keychainOptions,
      requireAuthentication: true,
      authenticationPrompt: options?.authenticationPrompt,
    });
  },
};

export default storage;
