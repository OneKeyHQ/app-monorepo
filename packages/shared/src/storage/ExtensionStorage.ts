/* eslint-disable @typescript-eslint/no-unused-vars */

// copy from:
//    node_modules/@react-native-async-storage/async-storage/types/index.d.ts
interface AsyncStorage {
  /**
   * Fetches key and passes the result to callback, along with an Error if there is any.
   */
  getItem(
    key: string,
    callback?: (error?: Error, result?: string) => void,
  ): Promise<string | null>;

  /**
   * Sets value for key and calls callback on completion, along with an Error if there is any
   */
  setItem(
    key: string,
    value: string,
    callback?: (error?: Error) => void,
  ): Promise<void>;

  removeItem(key: string, callback?: (error?: Error) => void): Promise<void>;

  /**
   * Merges existing value with input value, assuming they are stringified json. Returns a Promise object.
   * Not supported by all native implementation
   */
  mergeItem(
    key: string,
    value: string,
    callback?: (error?: Error) => void,
  ): Promise<void>;

  /**
   * Erases all AsyncStorage for all clients, libraries, etc. You probably don't want to call this.
   * Use removeItem or multiRemove to clear only your own keys instead.
   */
  clear(callback?: (error?: Error) => void): Promise<void>;

  /**
   * Gets all keys known to the app, for all callers, libraries, etc
   */
  getAllKeys(
    callback?: (error?: Error, keys?: string[]) => void,
  ): Promise<string[]>;

  /**
   * multiGet invokes callback with an array of key-value pair arrays that matches the input format of multiSet
   */
  multiGet(
    keys: string[],
    callback?: (errors?: Error[], result?: [string, string | null][]) => void,
  ): Promise<[string, string | null][]>;

  /**
   * multiSet and multiMerge take arrays of key-value array pairs that match the output of multiGet,
   *
   * multiSet([['k1', 'val1'], ['k2', 'val2']], cb);
   */
  multiSet(
    keyValuePairs: string[][],
    callback?: (errors?: Error[]) => void,
  ): Promise<void>;

  /**
   * Delete all the keys in the keys array.
   */
  multiRemove(
    keys: string[],
    callback?: (errors?: Error[]) => void,
  ): Promise<void>;

  /**
   * Merges existing values with input values, assuming they are stringified json.
   * Returns a Promise object.
   *
   * Not supported by all native implementations.
   */
  multiMerge(
    keyValuePairs: string[][],
    callback?: (errors?: Error[]) => void,
  ): Promise<void>;
}

class ExtensionStorage implements AsyncStorage {
  browser = chrome;

  setItem(key: string, value: string) {
    return this.browser.storage.local.set({
      [key]: value,
    });
  }

  async getItem(key: string) {
    return (await this.browser.storage.local.get(key))[key] as string;
  }

  async removeItem(key: string) {
    return this.browser.storage.local.remove(key);
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

export default ExtensionStorage;
