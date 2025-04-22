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
    database: IDBPDatabase<DBTypes>;
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

  nativeDB: IDBDatabase | null = null;

  private upgrade?: IDBInitOptions<DBTypes>['upgrade'];

  constructor(options: IDBInitOptions<DBTypes>) {
    this.bucket = options.bucket;
    this.name = options.name;
    this.version = options.version;
    this.upgrade = options.upgrade;
  }

  // @ts-ignore
  objectStoreNames: TypedDOMStringList<StoreNames<DBTypes>>;

  createObjectStore<Name extends StoreNames<DBTypes>>(
    name: Name,
    optionalParameters?: IDBObjectStoreParameters,
  ): IDBPObjectStore<
    DBTypes,
    ArrayLike<StoreNames<DBTypes>>,
    Name,
    'versionchange'
  > {
    const tx = this.transaction(
      Array.from([name]) as ArrayLike<StoreNames<DBTypes>>,
      'versionchange',
    );
    const store = this.nativeDB?.createObjectStore(name, optionalParameters);
    if (!store) {
      throw new Error('Failed to create object store');
    }

    return new IndexedDBObjectStorePromised({
      tx,
      store,
      mode: 'versionchange',
    });
  }

  deleteObjectStore(name: StoreNames<DBTypes>): void {
    throw new Error('Method not implemented.');
  }

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
      storeNames,
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
  ): Promise<IDBPTransaction<DBTypes, Names, Mode>> {
    const nativeDB = await this.open({ alwaysOpenNew: true });
    const tx = nativeDB.transaction(
      storeNames as unknown as string[],
      mode,
      options,
    );
    return new IndexedDBTransactionPromised({
      db: this,
      storeNames,
      mode,
      tx,
    });
  }

  add<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    value: StoreValue<DBTypes, Name>,
    key?: IDBKeyRange | StoreKey<DBTypes, Name> | undefined,
  ): Promise<StoreKey<DBTypes, Name>> {
    throw new Error('Method not implemented.');
  }

  count<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    key?: IDBKeyRange | StoreKey<DBTypes, Name> | null | undefined,
  ): Promise<number> {
    throw new Error('Method not implemented.');
  }

  countFromIndex<
    Name extends StoreNames<DBTypes>,
    IndexName extends IndexNames<DBTypes, Name>,
  >(
    storeName: Name,
    indexName: IndexName,
    key?: IDBKeyRange | IndexKey<DBTypes, Name, IndexName> | null | undefined,
  ): Promise<number> {
    throw new Error('Method not implemented.');
  }

  get<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    query: IDBKeyRange | StoreKey<DBTypes, Name>,
  ): Promise<StoreValue<DBTypes, Name> | undefined> {
    throw new Error('Method not implemented.');
  }

  getFromIndex<
    Name extends StoreNames<DBTypes>,
    IndexName extends IndexNames<DBTypes, Name>,
  >(
    storeName: Name,
    indexName: IndexName,
    query: IDBKeyRange | IndexKey<DBTypes, Name, IndexName>,
  ): Promise<StoreValue<DBTypes, Name> | undefined> {
    throw new Error('Method not implemented.');
  }

  getAllFromIndex<
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

  getAllKeys<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    query?: IDBKeyRange | StoreKey<DBTypes, Name> | null | undefined,
    count?: number,
  ): Promise<StoreKey<DBTypes, Name>[]> {
    throw new Error('Method not implemented.');
  }

  getAllKeysFromIndex<
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

  getKey<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    query: IDBKeyRange | StoreKey<DBTypes, Name>,
  ): Promise<StoreKey<DBTypes, Name> | undefined> {
    throw new Error('Method not implemented.');
  }

  getKeyFromIndex<
    Name extends StoreNames<DBTypes>,
    IndexName extends IndexNames<DBTypes, Name>,
  >(
    storeName: Name,
    indexName: IndexName,
    query: IDBKeyRange | IndexKey<DBTypes, Name, IndexName>,
  ): Promise<StoreKey<DBTypes, Name> | undefined> {
    throw new Error('Method not implemented.');
  }

  put<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    value: StoreValue<DBTypes, Name>,
    key?: IDBKeyRange | StoreKey<DBTypes, Name> | undefined,
  ): Promise<StoreKey<DBTypes, Name>> {
    throw new Error('Method not implemented.');
  }

  onabort: ((this: IDBDatabase, ev: Event) => any) | null = null;

  onclose: ((this: IDBDatabase, ev: Event) => any) | null = null;

  onerror: ((this: IDBDatabase, ev: Event) => any) | null = null;

  onversionchange:
    | ((this: IDBDatabase, ev: IDBVersionChangeEvent) => any)
    | null = null;

  addEventListener(type: unknown, listener: unknown, options?: unknown): void {
    throw new Error('Method not implemented.');
  }

  removeEventListener(
    type: unknown,
    listener: unknown,
    options?: unknown,
  ): void {
    throw new Error('Method not implemented.');
  }

  dispatchEvent(event: unknown): boolean {
    throw new Error('Method not implemented.');
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

  /**
   * 打开数据库连接
   */
  async open({
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
        // @ts-ignore
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
        if (this.upgrade) {
          const tx = new IndexedDBTransactionPromised({
            db: this,
            storeNames: [],
            mode: 'versionchange',
            tx: transaction!,
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

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.nativeDB) {
      this.nativeDB.close();
      this.nativeDB = null;
    }
  }

  /**
   * 删除数据库
   */
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

  /**
   * 获取事务
   */
  private async getTransaction(
    storeNames: string | string[],
    mode: IDBTransactionMode = 'readonly',
  ): Promise<IDBTransaction> {
    const db = await this.open({ alwaysOpenNew: true });
    return db.transaction(storeNames, mode);
  }

  /**
   * 获取对象存储
   */
  private async getObjectStore(
    storeName: string,
    mode: IDBTransactionMode = 'readonly',
  ): Promise<IDBObjectStore> {
    const transaction = await this.getTransaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  /**
   * 添加数据
   */
  async add0<T>(storeName: string, item: T): Promise<IDBValidKey> {
    const store = await this.getObjectStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.add(item as any);

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result);
      };
    });
  }

  /**
   * 添加多条数据
   */
  async addMany<T>(storeName: string, items: T[]): Promise<IDBValidKey[]> {
    const store = await this.getObjectStore(storeName, 'readwrite');
    const promises: Promise<IDBValidKey>[] = [];

    return new Promise((resolve, reject) => {
      items.forEach((item) => {
        const request = store.add(item as any);
        const promise = new Promise<IDBValidKey>((resolveItem, rejectItem) => {
          request.onsuccess = (event) => {
            resolveItem((event.target as IDBRequest).result);
          };

          request.onerror = (event) => {
            rejectItem((event.target as IDBRequest).error);
          };
        });

        promises.push(promise);
      });

      Promise.all(promises).then(resolve).catch(reject);
    });
  }

  /**
   * 获取数据
   */
  async get0<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    const store = await this.getObjectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.get(key);

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result as T | undefined);
      };
    });
  }

  /**
   * 获取所有数据
   */
  async getAll<T>(
    storeName: string,
    query?: IDBValidKey | IDBKeyRange | null,
    count?: number,
  ): Promise<T[]> {
    const store = await this.getObjectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getAll(query, count);

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result as T[]);
      };
    });
  }

  /**
   * 获取所有键
   */
  async getAllKeys0(
    storeName: string,
    query?: IDBValidKey | IDBKeyRange | null,
    count?: number,
  ): Promise<IDBValidKey[]> {
    const store = await this.getObjectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getAllKeys(query, count);

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result);
      };
    });
  }

  /**
   * 更新数据
   */
  async put0<T>(storeName: string, item: T): Promise<IDBValidKey> {
    const store = await this.getObjectStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(item as any);

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result);
      };
    });
  }

  /**
   * 删除数据
   */
  async delete(
    storeName: string,
    key: IDBValidKey | IDBKeyRange,
  ): Promise<void> {
    const store = await this.getObjectStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(key);

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * 清空存储
   */
  async clear(storeName: string): Promise<void> {
    const store = await this.getObjectStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * 计数
   */
  async count0(
    storeName: string,
    query?: IDBValidKey | IDBKeyRange,
  ): Promise<number> {
    const store = await this.getObjectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.count(query);

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result);
      };
    });
  }

  /**
   * 使用游标遍历数据
   */
  async iterate<T>(
    storeName: string,
    callback: (cursor: IDBCursorWithValue) => void | boolean,
    query?: IDBValidKey | IDBKeyRange | null,
    direction?: IDBCursorDirection,
  ): Promise<void> {
    const store = await this.getObjectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.openCursor(query, direction);

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest)
          .result as IDBCursorWithValue;
        if (cursor) {
          const result = callback(cursor);
          if (result !== false) {
            cursor.continue();
          } else {
            resolve();
          }
        } else {
          resolve();
        }
      };
    });
  }

  /**
   * 使用索引查询
   */
  async getByIndex<T>(
    storeName: string,
    indexName: string,
    key: IDBValidKey | IDBKeyRange,
  ): Promise<T | undefined> {
    const store = await this.getObjectStore(storeName);
    const index = store.index(indexName);

    return new Promise((resolve, reject) => {
      const request = index.get(key);

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result as T | undefined);
      };
    });
  }

  /**
   * 使用索引获取所有数据
   */
  async getAllByIndex<T>(
    storeName: string,
    indexName: string,
    query?: IDBValidKey | IDBKeyRange | null,
    count?: number,
  ): Promise<T[]> {
    const store = await this.getObjectStore(storeName);
    const index = store.index(indexName);

    return new Promise((resolve, reject) => {
      const request = index.getAll(query, count);

      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result as T[]);
      };
    });
  }
}
