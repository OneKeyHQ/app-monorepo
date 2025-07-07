import type { ISecureStorage } from './types';

const setSecureItem = async (key: string, data: string) =>
  globalThis?.desktopApiProxy?.storage?.secureSetItemAsync(key, data);

const getSecureItem = async (key: string) =>
  globalThis?.desktopApiProxy?.storage?.secureGetItemAsync(key) ?? null;

const removeSecureItem = async (key: string) =>
  globalThis?.desktopApiProxy?.storage?.secureDelItemAsync(key);

const supportSecureStorage = () => true;

const storage: ISecureStorage = {
  setSecureItem,
  getSecureItem,
  removeSecureItem,
  supportSecureStorage,
};

export default storage;
