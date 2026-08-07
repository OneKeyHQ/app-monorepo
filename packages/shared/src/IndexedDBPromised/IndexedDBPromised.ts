/* eslint-disable @typescript-eslint/no-unused-vars */
import { isString } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import appGlobals from '../appGlobals';
import platformEnv from '../platformEnv';
import storageChecker from '../storageChecker/storageChecker';

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

export interface ICreateBucketTransactionOptions extends IDBTransactionOptions {
  /**
   * Let the transaction through while the disk-full guard is raised. Set it
   * only for space-freeing work (delete / clear): those are what a user needs
   * in order to recover from exhausted storage, so blocking them turns a
   * recoverable state into a dead end.
   */
  allowWhenStorageFull?: boolean;
}

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

export class IndexedDBPromised<
  DBTypes extends DBSchema | unknown = unknown,
> implements IDBPDatabase<DBTypes> {
  private bucketName: string;

  name: string;

  version: number;

  private upgrade?: IDBInitOptions<DBTypes>['upgrade'];

  nativeDBFactory: IDBFactory | null = null;

  nativeDB: IDBDatabase | null = null;

  /**
   * In-flight `open()` request, so concurrent callers share one connection.
   * Without it every caller that arrives while the cache is empty opens its
   * own `IDBDatabase`; only the last one is kept and the rest leak as
   * unreferenced open connections, which then block any later `versionchange`
   * upgrade indefinitely.
   */
  private openPromise: Promise<IDBDatabase> | null = null;

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
    return this.nativeDB?.objectStoreNames as unknown as TypedDOMStringList<
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

  /**
   * Async counterpart of `transaction()` for ordinary bucket work such as DB
   * backup and bucket migration. Prefer it over the sync path: it can reopen a
   * connection the browser force-closed, whereas a sync API can only drop the
   * dead handle and rethrow, leaving its caller stuck until something else
   * reopens the database.
   */
  async transactionAsync<
    Names extends ArrayLike<StoreNames<DBTypes>>,
    Mode extends IDBTransactionMode = 'readonly',
  >(
    storeNames: Names,
    mode: Mode,
    options?: ICreateBucketTransactionOptions,
  ): Promise<IDBPTransaction<DBTypes, Names, Mode>> {
    return this.createBucketTransaction(storeNames, mode, options);
  }

  // use transactionAsync() for ordinary bucket db transactions
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

    // Ordinary writes made through this sync path (DB backup, bucket
    // migration) share the disk-full guard of `createBucketTransaction`.
    // `versionchange` stays exempt: schema upgrades must never be blocked.
    if (mode === 'readwrite') {
      storageChecker.checkIfDiskIsFullSync();
    }

    const storeNamesArray = Array.from(storeNames) as unknown as string[];
    let tx: IDBTransaction | undefined;
    try {
      tx = this.nativeDB?.transaction(storeNamesArray, mode, options);
    } catch (error) {
      if (storageChecker.isConnectionClosingError(error)) {
        // A sync API cannot reopen; drop the dead cached handle so the next
        // `open()` recovers instead of failing every later call.
        this.invalidateNativeDB('syncTransactionOnClosingConnection');
      }
      throw error;
    }
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
    options?: ICreateBucketTransactionOptions,
  ): Promise<IndexedDBTransactionPromised<DBTypes, Names, Mode>> {
    const { allowWhenStorageFull, ...restOptions } = options ?? {};
    if (mode !== 'readonly' && !allowWhenStorageFull) {
      storageChecker.checkIfDiskIsFullSync();
    }
    const nativeOptions: IDBTransactionOptions | undefined = Object.keys(
      restOptions,
    ).length
      ? restOptions
      : undefined;
    const storeNamesArray = Array.from(storeNames) as unknown as string[];

    const openTransaction = async () => {
      const nativeDB = await this.open();
      return nativeDB.transaction(storeNamesArray, mode, nativeOptions);
    };

    let tx: IDBTransaction;
    try {
      tx = await openTransaction();
    } catch (error) {
      if (!storageChecker.isConnectionClosingError(error)) {
        throw error;
      }
      // The cached handle was force-closed by the browser without our
      // `close()` running, so it can never serve a transaction again. Drop it
      // and reopen once rather than failing every later read and write.
      this.invalidateNativeDB('transactionOnClosingConnection');
      tx = await openTransaction();
    }

    return new IndexedDBTransactionPromised({
      db: this,
      mode,
      tx,
    });
  }

  /**
   * Forget the cached connection so the next call reopens it.
   *
   * `open()` caches one `IDBDatabase` and reuses it for every transaction, but
   * only our own `close()` used to reset that cache. When the browser
   * force-closes the connection instead — a `versionchange` raised by another
   * runtime, storage bucket eviction, a backing-store error — the cached
   * handle stayed behind as a dead object and every later `transaction()` threw
   * `InvalidStateError: ... The database connection is closing`.
   */
  private invalidateNativeDB(trigger: string) {
    if (this.nativeDB) {
      this.nativeDB = null;
      appGlobals?.$defaultLogger?.app.storage.connectionInvalidated({
        dbName: this.name,
        trigger,
      });
    }
  }

  /**
   * Drop the cached handle as soon as the browser tells us the connection is
   * going away, so the next transaction reopens instead of reusing a dead one.
   */
  private attachConnectionInvalidationHandlers(nativeDB: IDBDatabase) {
    nativeDB.addEventListener('close', () => {
      if (this.nativeDB === nativeDB) {
        this.invalidateNativeDB('close');
      }
    });
    nativeDB.addEventListener('versionchange', () => {
      // Another runtime is upgrading the same shared native database. Release
      // our handle so its upgrade transaction is not blocked.
      nativeDB.close();
      if (this.nativeDB === nativeDB) {
        this.invalidateNativeDB('versionchange');
      }
    });
  }

  async add<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    value: StoreValue<DBTypes, Name>,
    key?: IDBKeyRange | StoreKey<DBTypes, Name>,
  ): Promise<StoreKey<DBTypes, Name>> {
    const tx = await this.createBucketTransaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    return store.add(value, key);
  }

  async clear(name: StoreNames<DBTypes>): Promise<void> {
    const tx = await this.createBucketTransaction([name], 'readwrite', {
      allowWhenStorageFull: true,
    });
    const store = tx.objectStore(name);
    return store.clear();
  }

  async count<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    key?: IDBKeyRange | StoreKey<DBTypes, Name> | null,
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
    key?: IDBKeyRange | IndexKey<DBTypes, Name, IndexName> | null,
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
    const tx = await this.createBucketTransaction([storeName], 'readwrite', {
      allowWhenStorageFull: true,
    });
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
    query?: IDBKeyRange | IndexKey<DBTypes, Name, IndexName> | null,
    count?: number,
  ): Promise<StoreValue<DBTypes, Name>[]> {
    const tx = await this.createBucketTransaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    return index.getAll(query, count);
  }

  async getAllKeys<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    query?: IDBKeyRange | StoreKey<DBTypes, Name> | null,
    count?: number,
  ): Promise<StoreKey<DBTypes, Name>[]> {
    const tx = await this.createBucketTransaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    return store.getAllKeys(query, count);
  }

  async getAllEntries<Name extends StoreNames<DBTypes>>(
    storeName: Name,
  ): Promise<Map<string, StoreValue<DBTypes, Name>>> {
    const tx = await this.createBucketTransaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    const [keys, values] = await Promise.all([
      store.getAllKeys(),
      store.getAll(),
    ]);
    const map = new Map<string, StoreValue<DBTypes, Name>>();
    for (let i = 0; i < keys.length; i += 1) {
      map.set(String(keys[i]), values[i]);
    }
    return map;
  }

  async getAllKeysFromIndex<
    Name extends StoreNames<DBTypes>,
    IndexName extends IndexNames<DBTypes, Name>,
  >(
    storeName: Name,
    indexName: IndexName,
    query?: IDBKeyRange | IndexKey<DBTypes, Name, IndexName> | null,
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

  async open(): Promise<IDBDatabase> {
    // Check the in-flight promise BEFORE the cached handle: `onupgradeneeded`
    // publishes `this.nativeDB` early (the upgrade callback needs it for
    // `this.transaction()`), so while an upgrade is running the cached handle
    // is a half-open connection. Callers must wait for `onsuccess` instead of
    // starting normal transactions against it.
    if (this.openPromise) {
      return this.openPromise;
    }
    if (this.nativeDB) {
      return this.nativeDB;
    }
    this.openPromise = this.doOpen();
    try {
      return await this.openPromise;
    } finally {
      this.openPromise = null;
    }
  }

  private async doOpen(): Promise<IDBDatabase> {
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

        this.attachConnectionInvalidationHandlers(nativeDB);
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
    this.openPromise = null;
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
    const dbFactory =
      await IndexedDBPromised.getBucketIndexedDBFactory(bucketName);
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
