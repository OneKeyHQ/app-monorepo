import type { ISecureStorage } from './types';

const setSecureItem = async (key: string, data: string) =>
  globalThis?.desktopApi.secureSetItemAsync(key, data);

const getSecureItem = async (key: string) =>
  globalThis?.desktopApi.secureGetItemAsync(key);

const removeSecureItem = async (key: string) =>
  globalThis?.desktopApi.secureDelItemAsync(key);

const supportSecureStorage = () => true;

const storage: ISecureStorage = {
  setSecureItem,
  getSecureItem,
  removeSecureItem,
  supportSecureStorage,
};

export default storage;
