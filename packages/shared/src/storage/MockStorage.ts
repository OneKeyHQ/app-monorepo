/* eslint-disable @typescript-eslint/no-unused-vars */
import { IAsyncStorage } from './ExtensionStorage';

class MockStorage implements IAsyncStorage {
  getItem(
    key: string,
    callback?: (error?: Error, result?: string) => void,
  ): Promise<string | null> {
    return Promise.resolve(null);
  }

  setItem(
    key: string,
    value: string,
    callback?: (error?: Error) => void,
  ): Promise<void> {
    return Promise.resolve(undefined);
  }

  removeItem(key: string, callback?: (error?: Error) => void): Promise<void> {
    return Promise.resolve(undefined);
  }

  clear(callback?: (error?: Error) => void): Promise<void> {
    return Promise.resolve(undefined);
  }

  getAllKeys(
    callback?: (error?: Error, keys?: string[]) => void,
  ): Promise<string[]> {
    return Promise.resolve([]);
  }

  mergeItem(
    key: string,
    value: string,
    callback?: (error?: Error) => void,
  ): Promise<void> {
    return Promise.resolve(undefined);
  }

  multiGet(
    keys: string[],
    callback?: (errors?: Error[], result?: [string, string | null][]) => void,
  ): Promise<[string, string | null][]> {
    return Promise.resolve([]);
  }

  multiMerge(
    keyValuePairs: string[][],
    callback?: (errors?: Error[]) => void,
  ): Promise<void> {
    return Promise.resolve(undefined);
  }

  multiRemove(
    keys: string[],
    callback?: (errors?: Error[]) => void,
  ): Promise<void> {
    return Promise.resolve(undefined);
  }

  multiSet(
    keyValuePairs: string[][],
    callback?: (errors?: Error[]) => void,
  ): Promise<void> {
    return Promise.resolve(undefined);
  }
}

export default MockStorage;
