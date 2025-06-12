/* eslint-disable @typescript-eslint/no-unused-vars */
import { isString } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import platformEnv from '../platformEnv';

import { IndexedDBObjectStorePromised } from './IndexedDBObjectStorePromised';
import indexedDBPromisedUtils from './indexedDBPromisedUtils';
import { IndexedDBTransactionPromised } from './IndexedDBTransactionPromised';

import type {
  DBSchema,
  IDBPDatabase,
  IDBPObjectStore,
  IDBPTransaction,
  IndexKey,
  IndexNames,
  StoreKey,
  StoreNames,
  StoreValue,
  TypedDOMStringList,
} from 'idb';

export interface IDBInitOptions<DBTypes extends DBSchema | unknown = unknown> {
  bucketName: string;
  name: string;
  version: number;
  stores?: {
    [storeName: string]: {
      keyPath?: string | string[];
      autoIncrement?: boolean;
      indexes?: {
        name: string;
        keyPath: string | string[];
        options?: IDBIndexParameters;
      }[];
    };
  };
  upgrade?: (params: {
    nativeDB: IDBDatabase;
    database: IndexedDBPromised<DBTypes>;
    oldVersion: number;
    newVersion: number | null;
    transaction: IndexedDBTransactionPromised<
      DBTypes,
      ArrayLike<StoreNames<DBTypes>>,
      'versionchange'
    >;
    event: IDBVersionChangeEvent;
  }) => void;
}

export class IndexedDBPromised<DBTypes extends DBSchema | unknown = unknown>
  implements IDBPDatabase<DBTypes>
{
  private bucketName: string;

  name: string;

  version: number;

  private upgrade?: IDBInitOptions<DBTypes>['upgrade'];

  nativeDBFactory: IDBFactory | null = null;

  nativeDB: IDBDatabase | null = null;

  onabort: ((this: IDBDatabase, ev: Event) => any) | null = null;

  onclose: ((this: IDBDatabase, ev: Event) => any) | null = null;

  onerror: ((this: IDBDatabase, ev: Event) => any) | null = null;

  onversionchange:
    | ((this: IDBDatabase, ev: IDBVersionChangeEvent) => any)
    | null = null;

  constructor(options: IDBInitOptions<DBTypes>) {
    if (!isString(options.name)) {
      throw new OneKeyLocalError(
        `IndexedDBPromised ERROR: database name must be a string`,
      );
    }
    this.bucketName = options.bucketName;
    this.name = options.name;
    this.version = options.version;
    this.upgrade = options.upgrade;
  }

  ensureDBOpened() {
    if (!this.nativeDB) {
      throw new OneKeyLocalError(
        `IndexedDBPromised ERROR: DB not opened yet: ${this.bucketName} ${this.name}`,
      );
    }
  }

  get objectStoreNames(): TypedDOMStringList<StoreNames<DBTypes>> {
    this.ensureDBOpened();
    return this.nativeDB?.objectStoreNames as TypedDOMStringList<
      StoreNames<DBTypes>
    >;
  }

  createObjectStore<Name extends StoreNames<DBTypes>>(
    name: Name,
    optionalParameters?: IDBObjectStoreParameters,
  ): IndexedDBObjectStorePromised<
    DBTypes,
    ArrayLike<StoreNames<DBTypes>>,
    Name,
    'versionchange'
  > {
    this.ensureDBOpened();
    const store = this.nativeDB?.createObjectStore(name, optionalParameters);
    if (!store) {
      throw new OneKeyLocalError(
        `IndexedDBPromised ERROR: Object store create failed: ${this.bucketName} ${this.name} ${name}`,
      );
    }

    const tx = this.transaction(
      Array.from([name]) as ArrayLike<StoreNames<DBTypes>>,
      'versionchange',
    );
    return new IndexedDBObjectStorePromised({
      tx,
      store,
      mode: 'versionchange',
    });
  }

  deleteObjectStore(name: StoreNames<DBTypes>): void {
    this.ensureDBOpened();
    this.nativeDB?.deleteObjectStore(name);
  }

  // use getTransactionAsync() if get bucket db transaction
  // sync transaction() is only for sync createObjectStore()
  transaction<
    Names extends ArrayLike<StoreNames<DBTypes>>,
    Mode extends IDBTransactionMode = 'readonly',
  >(
    storeNames: Names,
    mode: Mode,
    options?: IDBTransactionOptions,
  ): IDBPTransaction<DBTypes, Names, Mode> {
    this.ensureDBOpened();

    const storeNamesArray = Array.from(storeNames) as unknown as string[];
    const tx = this.nativeDB?.transaction(storeNamesArray, mode, options);
    if (!tx) {
      throw new OneKeyLocalError(
        `IndexedDBPromised ERROR: DB Transaction create failed: ${
          this.bucketName
        } ${this.name} ${storeNamesArray.join(', ')}`,
      );
    }
    return new IndexedDBTransactionPromised({
      db: this,
      mode,
      tx,
    });
  }

  async createBucketTransaction<
    Names extends ArrayLike<StoreNames<DBTypes>>,
    Mode extends IDBTransactionMode = 'readonly',
  >(
    storeNames: Names,
    mode: Mode,
    options?: IDBTransactionOptions,
  ): Promise<IndexedDBTransactionPromised<DBTypes, Names, Mode>> {
    const nativeDB = await this.open({ alwaysOpenNew: true });
    const storeNamesArray = Array.from(storeNames) as unknown as string[];
    const tx = nativeDB.transaction(storeNamesArray, mode, options);
    return new IndexedDBTransactionPromised({
      db: this,
      mode,
      tx,
    });
  }

  async add<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    value: StoreValue<DBTypes, Name>,
    key?: IDBKeyRange | StoreKey<DBTypes, Name> | undefined,
  ): Promise<StoreKey<DBTypes, Name>> {
    const tx = await this.createBucketTransaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    return store.add(value, key);
  }

  async clear(name: StoreNames<DBTypes>): Promise<void> {
    const tx = await this.createBucketTransaction([name], 'readwrite');
    const store = tx.objectStore(name);
    return store.clear();
  }

  async count<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    key?: IDBKeyRange | StoreKey<DBTypes, Name> | null | undefined,
  ): Promise<number> {
    const tx = await this.createBucketTransaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    return store.count(key);
  }

  async countFromIndex<
    Name extends StoreNames<DBTypes>,
    IndexName extends IndexNames<DBTypes, Name>,
  >(
    storeName: Name,
    indexName: IndexName,
    key?: IDBKeyRange | IndexKey<DBTypes, Name, IndexName> | null | undefined,
  ): Promise<number> {
    const tx = await this.createBucketTransaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    return index.count(key);
  }

  async delete<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    key: StoreKey<DBTypes, Name> | IDBKeyRange,
  ): Promise<void> {
    const tx = await this.createBucketTransaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    return store.delete(key);
  }

  async get<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    query: StoreKey<DBTypes, Name> | IDBKeyRange,
  ): Promise<StoreValue<DBTypes, Name> | undefined> {
    const tx = await this.createBucketTransaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    return store.get(query);
  }

  async getFromIndex<
    Name extends StoreNames<DBTypes>,
    IndexName extends IndexNames<DBTypes, Name>,
  >(
    storeName: Name,
    indexName: IndexName,
    query: IDBKeyRange | IndexKey<DBTypes, Name, IndexName>,
  ): Promise<StoreValue<DBTypes, Name> | undefined> {
    const tx = await this.createBucketTransaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    return index.get(query);
  }

  async getAll<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    query?: StoreKey<DBTypes, Name> | IDBKeyRange | null,
    count?: number,
  ): Promise<StoreValue<DBTypes, Name>[]> {
    const tx = await this.createBucketTransaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    return store.getAll(query, count);
  }

  async getAllFromIndex<
    Name extends StoreNames<DBTypes>,
    IndexName extends IndexNames<DBTypes, Name>,
  >(
    storeName: Name,
    indexName: IndexName,
    query?: IDBKeyRange | IndexKey<DBTypes, Name, IndexName> | null | undefined,
    count?: number,
  ): Promise<StoreValue<DBTypes, Name>[]> {
    const tx = await this.createBucketTransaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    return index.getAll(query, count);
  }

  async getAllKeys<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    query?: IDBKeyRange | StoreKey<DBTypes, Name> | null | undefined,
    count?: number,
  ): Promise<StoreKey<DBTypes, Name>[]> {
    const tx = await this.createBucketTransaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    return store.getAllKeys(query, count);
  }

  async getAllKeysFromIndex<
    Name extends StoreNames<DBTypes>,
    IndexName extends IndexNames<DBTypes, Name>,
  >(
    storeName: Name,
    indexName: IndexName,
    query?: IDBKeyRange | IndexKey<DBTypes, Name, IndexName> | null | undefined,
    count?: number,
  ): Promise<StoreKey<DBTypes, Name>[]> {
    const tx = await this.createBucketTransaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    return index.getAllKeys(query, count);
  }

  async getKey<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    query: IDBKeyRange | StoreKey<DBTypes, Name>,
  ): Promise<StoreKey<DBTypes, Name> | undefined> {
    const tx = await this.createBucketTransaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    return store.getKey(query);
  }

  async getKeyFromIndex<
    Name extends StoreNames<DBTypes>,
    IndexName extends IndexNames<DBTypes, Name>,
  >(
    storeName: Name,
    indexName: IndexName,
    query: IDBKeyRange | IndexKey<DBTypes, Name, IndexName>,
  ): Promise<StoreKey<DBTypes, Name> | undefined> {
    const tx = await this.createBucketTransaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    return index.getKey(query);
  }

  async put<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    value: StoreValue<DBTypes, Name>,
    key?: StoreKey<DBTypes, Name> | IDBKeyRange,
  ): Promise<StoreKey<DBTypes, Name>> {
    const tx = await this.createBucketTransaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    return store.put(value, key);
  }

  addEventListener<K extends keyof IDBDatabaseEventMap>(
    type: K,
    listener: (this: IDBDatabase, ev: IDBDatabaseEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
  ): void {
    this.ensureDBOpened();
    this.nativeDB?.addEventListener(type, listener, options);
  }

  removeEventListener<K extends keyof IDBDatabaseEventMap>(
    type: K,
    listener: (this: IDBDatabase, ev: IDBDatabaseEventMap[K]) => any,
    options?: boolean | EventListenerOptions,
  ): void {
    this.ensureDBOpened();
    this.nativeDB?.removeEventListener(type, listener, options);
  }

  dispatchEvent(event: Event): boolean {
    this.ensureDBOpened();
    return this.nativeDB?.dispatchEvent(event) ?? false;
  }

  async open({
    alwaysOpenNew = false,
  }: {
    alwaysOpenNew?: boolean;
  } = {}): Promise<IDBDatabase> {
    // if (this.nativeDB && !alwaysOpenNew) {
    //   return this.nativeDB;
    // }

    if (this.nativeDB) {
      return this.nativeDB;
    }

    if (!this.nativeDBFactory) {
      // TODO should always open bucket or database? can we cache the bucket instance?
      const dbFactory = await IndexedDBPromised.getBucketIndexedDBFactory(
        this.bucketName,
      );
      this.nativeDBFactory = dbFactory;
    }
    const request: IDBOpenDBRequest = this.nativeDBFactory.open(
      this.name,
      this.version,
    );

    return new Promise((resolve, reject) => {
      request.onerror = (event) => {
        const target = event.target as IDBOpenDBRequest;
        reject(target?.error || indexedDBPromisedUtils.newDBOpenError());
      };

      request.onsuccess = (event) => {
        const target = event.target as IDBOpenDBRequest;
        const nativeDB = target.result;

        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        nativeDB.$$nonce = Date.now();

        this.nativeDB = nativeDB;
        resolve(nativeDB);
      };

      request.onupgradeneeded = (event) => {
        const target = event.target as IDBOpenDBRequest;
        const nativeDB = target.result;
        this.nativeDB = nativeDB;
        const transaction = target.transaction;
        const oldVersion = event.oldVersion;
        const newVersion = event.newVersion;

        // 如果提供了升级回调，则使用自定义升级逻辑
        if (this.upgrade && transaction) {
          const tx = new IndexedDBTransactionPromised({
            db: this,
            mode: 'versionchange',
            tx: transaction,
          });
          this.upgrade({
            nativeDB,
            database: this,
            oldVersion,
            newVersion,
            transaction: tx,
            event,
          });
        }
      };
    });
  }

  close(): void {
    if (this.nativeDB) {
      this.nativeDB.close();
      this.nativeDB = null;
      this.nativeDBFactory = null;
    }
  }

  static async getBucketIndexedDBFactory(
    bucketName: string,
  ): Promise<IDBFactory> {
    if (platformEnv.isJest) {
      return globalThis.indexedDB;
    }
    const bucketOptions: IStorageBucketOptions = {
      durability: 'strict', // Or `'relaxed'`.
      persisted: true, // Or `false`.
    };
    const storageBuckets = (globalThis?.navigator as INavigator | undefined)
      ?.storageBuckets;
    // const bucket = await storageBuckets?.open(bucketName, bucketOptions);
    if (!storageBuckets) {
      // throw new OneKeyLocalError(
      //   'IndexedDBPromised ERROR: navigator.storageBuckets is not supported',
      // );
      // Firefox、Safari not support storageBuckets, use globalThis.indexedDB as fallback
      return globalThis.indexedDB;
    }
    const bucket = await storageBuckets?.open(bucketName, bucketOptions);
    if (!bucket?.indexedDB) {
      throw new OneKeyLocalError(
        `IndexedDBPromised ERROR: Failed to open bucket indexedDB: ${bucketName}`,
      );
    }
    return bucket.indexedDB;
  }

  static async deleteDatabase({
    bucketName,
    name,
  }: {
    bucketName: string;
    name: string;
  }): Promise<IDBDatabase> {
    const dbFactory = await IndexedDBPromised.getBucketIndexedDBFactory(
      bucketName,
    );
    const request: IDBOpenDBRequest = dbFactory.deleteDatabase(name);
    return indexedDBPromisedUtils.toPromiseResult({ request });
    // return new Promise((resolve, reject) => {
    //   request.onerror = (event) => {
    //     reject(request.error);
    //   };

    //   request.onsuccess = () => {
    //     resolve(request.result);
    //   };
    // });
  }
}
