import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';

import type { ISecureStorage } from './types';

export const setSecureItem = async (key: string, data: string) =>
  setItemAsync(key, data);

export const getSecureItem = async (key: string) => getItemAsync(key);

export const removeSecureItem = async (key: string) => deleteItemAsync(key);

const supportSecureStorage = () => true;

const storage: ISecureStorage = {
  setSecureItem,
  getSecureItem,
  removeSecureItem,
  supportSecureStorage,
};

export default storage;
