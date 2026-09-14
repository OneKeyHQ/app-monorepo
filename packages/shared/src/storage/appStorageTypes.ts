import type { ISyncStorage } from './instance/syncStorageInstance';
import type MockStorage from './MockStorage';
import type { ISecureStorage } from './secureStorage/types';

export type IAsyncStorageCallback = (error?: Error | null) => void;

export type IAsyncStorageCallbackWithResult<T> = (
  error?: Error | null,
  result?: T | null,
) => void;

export type IAsyncStorageKeyValuePair = [string, string | null];

export type IAsyncStorageMultiCallback = (
  errors?: readonly (Error | null)[] | null,
) => void;

export type IAsyncStorageMultiGetCallback = (
  errors?: readonly (Error | null)[] | null,
  result?: readonly IAsyncStorageKeyValuePair[],
) => void;

/** Repository-owned compatibility surface for AsyncStorage consumers. */
export type AsyncStorageStatic = {
  getItem: (
    key: string,
    callback?: IAsyncStorageCallbackWithResult<string>,
  ) => Promise<string | null>;
  setItem: (
    key: string,
    value: string,
    callback?: IAsyncStorageCallback,
  ) => Promise<void>;
  removeItem: (key: string, callback?: IAsyncStorageCallback) => Promise<void>;
  mergeItem: (
    key: string,
    value: string,
    callback?: IAsyncStorageCallback,
  ) => Promise<void>;
  clear: (callback?: IAsyncStorageCallback) => Promise<void>;
  getAllKeys: (
    callback?: IAsyncStorageCallbackWithResult<readonly string[]>,
  ) => Promise<readonly string[]>;
  flushGetRequests: () => void;
  multiGet: (
    keys: readonly string[],
    callback?: IAsyncStorageMultiGetCallback,
  ) => Promise<readonly IAsyncStorageKeyValuePair[]>;
  multiSet: (
    keyValuePairs: ReadonlyArray<readonly [string, string]>,
    callback?: IAsyncStorageMultiCallback,
  ) => Promise<void>;
  multiRemove: (
    keys: readonly string[],
    callback?: IAsyncStorageMultiCallback,
  ) => Promise<void>;
  multiMerge: (
    keyValuePairs: Array<[string, string]>,
    callback?: IAsyncStorageMultiCallback,
  ) => Promise<void>;
};

export interface IAppStorage extends AsyncStorageStatic {
  syncStorage: ISyncStorage;
  secureStorage: ISecureStorage;
}

export type ITravelModeAwareAsyncStorage = AsyncStorageStatic;

export type IAppStorageHub = {
  appStorage: IAppStorage;
  _mockStorage: MockStorage;
  // web storage
  _webStorageLegacy: IAppStorage | undefined;
  $webStorageSimpleDB: IAppStorage | undefined;
  $webStorageGlobalStates: IAppStorage | undefined;
};
