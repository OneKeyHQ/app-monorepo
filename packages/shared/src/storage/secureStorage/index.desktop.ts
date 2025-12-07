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

const supportSecureStorage = () => true;

const storage: ISecureStorage = {
  setSecureItem,
  getSecureItem,
  removeSecureItem,
  supportSecureStorage,
};

export default storage;
