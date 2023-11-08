import type { ISecureStorage } from './types';

const setSecureItem = async (key: string, data: string) =>
  window?.desktopApi.secureSetItemAsync(key, data);

const getSecureItem = async (key: string) =>
  window?.desktopApi.secureGetItemAsync(key);

const removeSecureItem = async (key: string) =>
  window?.desktopApi.secureDelItemAsync(key);

const storage: ISecureStorage = {
  setSecureItem,
  getSecureItem,
  removeSecureItem,
};

export default storage;
