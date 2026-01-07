import { OneKeyLocalError } from '../../errors';
import platformEnv from '../../platformEnv';

import type { ISecureStorage } from './types';

const setSecureItem = async (key: string, data: string) => {
  const r = await globalThis?.desktopApiProxy?.storage?.secureSetItemAsync(
    key,
    data,
  );
  return r;
};

const getSecureItem = async (key: string) => {
  const v = await globalThis?.desktopApiProxy?.storage?.secureGetItemAsync(key);
  return v ?? null;
};

const removeSecureItem = async (key: string) =>
  globalThis?.desktopApiProxy?.storage?.secureDelItemAsync(key);

const supportSecureStorage = async () => {
  // The secure storage of the desktop in the development environment does not work, the data written only has the key, and the value is always empty
  if (platformEnv.isDesktop && platformEnv.isDev) {
    return false;
  }
  return true;
};

const storage: ISecureStorage = {
  setSecureItem,
  getSecureItem,
  removeSecureItem,
  supportSecureStorage,
  setSecureItemWithBiometrics(key, data, options) {
    // TODO: mac use keychain to set secure item
    throw new OneKeyLocalError('use webauthn/keychain to set secure item');
  },
};

export default storage;
