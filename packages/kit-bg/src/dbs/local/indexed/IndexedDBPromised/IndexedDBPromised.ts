/* eslint-disable @typescript-eslint/no-unused-vars */
import { IndexedDBObjectStorePromised } from './IndexedDBObjectStorePromised';
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
  bucket: string;
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
    transaction: IDBPTransaction<
      DBTypes,
      StoreNames<DBTypes>[],
      'versionchange'
    >;
    event: IDBVersionChangeEvent;
  }) => void;
}

export class IndexedDBPromised<DBTypes extends DBSchema | unknown = unknown>
  implements IDBPDatabase<DBTypes>
{
  private bucket: string;

  name: string;

  version: number;

  private upgrade?: IDBInitOptions<DBTypes>['upgrade'];

  nativeDB: IDBDatabase | null = null;

  onabort: ((this: IDBDatabase, ev: Event) => any) | null = null;

  onclose: ((this: IDBDatabase, ev: Event) => any) | null = null;

  onerror: ((this: IDBDatabase, ev: Event) => any) | null = null;

  onversionchange:
    | ((this: IDBDatabase, ev: IDBVersionChangeEvent) => any)
    | null = null;

  constructor(options: IDBInitOptions<DBTypes>) {
    this.bucket = options.bucket;
    this.name = options.name;
    this.version = options.version;
    this.upgrade = options.upgrade;
  }

  get objectStoreNames(): TypedDOMStringList<StoreNames<DBTypes>> {
    if (!this.nativeDB) {
      throw new Error('db not open yet');
    }
    return this.nativeDB?.objectStoreNames as TypedDOMStringList<
      StoreNames<DBTypes>
    >;
  }

  createObjectStore<Name extends StoreNames<DBTypes>>(
    name: Name,
    optionalParameters?: IDBObjectStoreParameters,
  ): IDBPObjectStore<
    DBTypes,
    ArrayLike<StoreNames<DBTypes>>,
    Name,
    'versionchange'
  > {
    const store = this.nativeDB?.createObjectStore(name, optionalParameters);
    if (!store) {
      throw new Error('Failed to create object store');
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
    throw new Error('Method not implemented.');
  }

  // use getTransactionAsync() if get bucket db transaction
  transaction<
    Names extends ArrayLike<StoreNames<DBTypes>>,
    Mode extends IDBTransactionMode = 'readonly',
  >(
    storeNames: Names,
    mode: Mode,
    options?: IDBTransactionOptions,
  ): IDBPTransaction<DBTypes, Names, Mode> {
    if (!this.nativeDB) {
      throw new Error('Database not opened');
    }

    const tx = this.nativeDB.transaction(
      storeNames as unknown as string[],
      mode,
      options,
    );
    return new IndexedDBTransactionPromised({
      db: this,
      mode,
      tx,
    });
  }

  async getTransactionAsync<
    Names extends ArrayLike<StoreNames<DBTypes>>,
    Mode extends IDBTransactionMode = 'readonly',
  >(
    storeNames: Names,
    mode: Mode,
    options?: IDBTransactionOptions,
  ): Promise<IndexedDBTransactionPromised<DBTypes, Names, Mode>> {
    const nativeDB = await this._openDB({ alwaysOpenNew: true });
    const tx = nativeDB.transaction(
      storeNames as unknown as string[],
      mode,
      options,
    );
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
    throw new Error('Method not implemented.');
  }

  async clear(name: StoreNames<DBTypes>): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async count<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    key?: IDBKeyRange | StoreKey<DBTypes, Name> | null | undefined,
  ): Promise<number> {
    throw new Error('Method not implemented.');
  }

  async countFromIndex<
    Name extends StoreNames<DBTypes>,
    IndexName extends IndexNames<DBTypes, Name>,
  >(
    storeName: Name,
    indexName: IndexName,
    key?: IDBKeyRange | IndexKey<DBTypes, Name, IndexName> | null | undefined,
  ): Promise<number> {
    throw new Error('Method not implemented.');
  }

  async delete<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    key: StoreKey<DBTypes, Name> | IDBKeyRange,
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async get<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    query: StoreKey<DBTypes, Name> | IDBKeyRange,
  ): Promise<StoreValue<DBTypes, Name> | undefined> {
    throw new Error('Method not implemented.');
  }

  async getFromIndex<
    Name extends StoreNames<DBTypes>,
    IndexName extends IndexNames<DBTypes, Name>,
  >(
    storeName: Name,
    indexName: IndexName,
    query: IDBKeyRange | IndexKey<DBTypes, Name, IndexName>,
  ): Promise<StoreValue<DBTypes, Name> | undefined> {
    throw new Error('Method not implemented.');
  }

  async getAll<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    query?: StoreKey<DBTypes, Name> | IDBKeyRange | null,
    count?: number,
  ): Promise<StoreValue<DBTypes, Name>[]> {
    throw new Error('Method not implemented.');
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
    throw new Error('Method not implemented.');
  }

  async getAllKeys<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    query?: IDBKeyRange | StoreKey<DBTypes, Name> | null | undefined,
    count?: number,
  ): Promise<StoreKey<DBTypes, Name>[]> {
    throw new Error('Method not implemented.');
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
    throw new Error('Method not implemented.');
  }

  async getKey<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    query: IDBKeyRange | StoreKey<DBTypes, Name>,
  ): Promise<StoreKey<DBTypes, Name> | undefined> {
    throw new Error('Method not implemented.');
  }

  async getKeyFromIndex<
    Name extends StoreNames<DBTypes>,
    IndexName extends IndexNames<DBTypes, Name>,
  >(
    storeName: Name,
    indexName: IndexName,
    query: IDBKeyRange | IndexKey<DBTypes, Name, IndexName>,
  ): Promise<StoreKey<DBTypes, Name> | undefined> {
    throw new Error('Method not implemented.');
  }

  async put<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    value: StoreValue<DBTypes, Name>,
    key?: StoreKey<DBTypes, Name> | IDBKeyRange,
  ): Promise<StoreKey<DBTypes, Name>> {
    throw new Error('Method not implemented.');
  }

  addEventListener<K extends keyof IDBDatabaseEventMap>(
    type: K,
    listener: (this: IDBDatabase, ev: IDBDatabaseEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
  ): void {
    throw new Error('Method not implemented.');
  }

  removeEventListener<K extends keyof IDBDatabaseEventMap>(
    type: K,
    listener: (this: IDBDatabase, ev: IDBDatabaseEventMap[K]) => any,
    options?: boolean | EventListenerOptions,
  ): void {
    throw new Error('Method not implemented.');
  }

  dispatchEvent(event: Event): boolean {
    throw new Error('Method not implemented.');
  }

  async _openDB({
    alwaysOpenNew = false,
  }: {
    alwaysOpenNew?: boolean;
  } = {}): Promise<IDBDatabase> {
    if (this.nativeDB && !alwaysOpenNew) {
      return this.nativeDB;
    }

    // TODO should always open bucket or database? can we cache the bucket instance?
    const dbInstance = await IndexedDBPromised.getIndexedDbInstance(
      this.bucket,
    );
    return new Promise((resolve, reject) => {
      const request = dbInstance.open(this.name, this.version);

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = (event) => {
        const nativeDB = (event.target as IDBRequest).result;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        nativeDB.$$nonce = Date.now();

        this.nativeDB = nativeDB;
        resolve(nativeDB);
      };

      request.onupgradeneeded = (event) => {
        const nativeDB = (event.target as IDBRequest).result;
        this.nativeDB = nativeDB;
        const transaction = (event.target as IDBRequest).transaction;
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
    }
  }

  static async getIndexedDbInstance(bucketName: string) {
    const bucketOptions: IStorageBucketOptions = {
      durability: 'strict', // Or `'relaxed'`.
      persisted: true, // Or `false`.
    };
    const storageBuckets = (globalThis?.navigator as INavigator | undefined)
      ?.storageBuckets;
    // const bucket = await storageBuckets?.open(bucketName, bucketOptions);
    if (!storageBuckets) {
      throw new Error('storageBuckets is not supported');
    }
    const bucket = await storageBuckets?.open(bucketName, bucketOptions);
    if (!bucket?.indexedDB) {
      throw new Error(`Failed to open bucket indexedDB: ${bucketName}`);
    }
    return bucket.indexedDB;
  }

  static async deleteDatabase({
    bucketName,
    name,
  }: {
    bucketName: string;
    name: string;
  }): Promise<void> {
    const dbInstance = await IndexedDBPromised.getIndexedDbInstance(bucketName);
    return new Promise((resolve, reject) => {
      const request = dbInstance.deleteDatabase(name);

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }
}
