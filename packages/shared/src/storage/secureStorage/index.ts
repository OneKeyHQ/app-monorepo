/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ISecureStorage } from './typrs';

const setSecureItem = async (key: string, data: string) =>
  Promise.reject(new Error('no supported'));

const getSecureItem: (key: string) => Promise<string | null> = async (
  key: string,
) => null;

const removeSecureItem = async (key: string) =>
  Promise.reject(new Error('no supported'));

const storage: ISecureStorage = {
  setSecureItem,
  getSecureItem,
  removeSecureItem,
};

export default storage;
