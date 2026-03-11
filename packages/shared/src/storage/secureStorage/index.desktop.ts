import { OneKeyLocalError } from '../../errors';
import platformEnv from '../../platformEnv';

import type { ISecureStorage, ISecureStorageSetOptions } from './types';

const setSecureItem = async (
  key: string,
  data: string,
  _options?: ISecureStorageSetOptions,
) => {
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
  if (platformEnv.isDesktop && platformEnv.isDev) {
    return false;
  }
  const available =
    await globalThis?.desktopApiProxy?.storage?.isSecureStorageAvailable?.();
  return available ?? false;
};

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
  setSecureItemWithBiometrics(_key, _data, _options) {
    // TODO: mac use keychain to set secure item
    throw new OneKeyLocalError('use webauthn/keychain to set secure item');
  },
};

export default storage;
