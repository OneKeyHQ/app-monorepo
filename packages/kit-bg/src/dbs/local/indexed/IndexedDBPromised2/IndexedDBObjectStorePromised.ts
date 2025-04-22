/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
  DBSchema,
  IDBPCursor,
  IDBPCursorWithValue,
  IDBPCursorWithValueIteratorValue,
  IDBPIndex,
  IDBPObjectStore,
  IDBPTransaction,
  IndexNames,
  StoreKey,
  StoreNames,
  StoreValue,
  TypedDOMStringList,
} from 'idb';

export class IndexedDBObjectStorePromised<
  DBTypes extends DBSchema | unknown = unknown,
  TxStores extends ArrayLike<StoreNames<DBTypes>> = ArrayLike<
    StoreNames<DBTypes>
  >,
  StoreName extends StoreNames<DBTypes> = StoreNames<DBTypes>,
  Mode extends IDBTransactionMode = 'readonly',
> implements IDBPObjectStore<DBTypes, TxStores, StoreName, Mode>
{
  readonly store: IDBObjectStore;

  readonly mode: Mode;

  transaction: IDBPTransaction<DBTypes, TxStores, Mode>;

  get indexNames(): TypedDOMStringList<IndexNames<DBTypes, StoreName>> {
    return this.store.indexNames as unknown as TypedDOMStringList<
      IndexNames<DBTypes, StoreName>
    >;
  }

  async count(
    key?: IDBKeyRange | StoreKey<DBTypes, StoreName> | null | undefined,
  ): Promise<number> {
    const request = this.store.count(key as IDBValidKey | IDBKeyRange);
    const result = await new Promise((resolve, reject) => {
      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };
      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result);
      };
    });
    return result as number;
  }

  async get(
    query: IDBKeyRange | StoreKey<DBTypes, StoreName>,
  ): Promise<StoreValue<DBTypes, StoreName> | undefined> {
    const request = this.store.get(query);
    const result = await new Promise((resolve, reject) => {
      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };

      request.onsuccess = (event) => {
        resolve(
          (event.target as IDBRequest).result as
            | StoreValue<DBTypes, StoreName>
            | undefined,
        );
      };
    });
    return result as StoreValue<DBTypes, StoreName> | undefined;
  }

  async getAll(
    query?: IDBKeyRange | StoreKey<DBTypes, StoreName> | null | undefined,
    count?: number,
  ): Promise<StoreValue<DBTypes, StoreName>[]> {
    const request = this.store.getAll(query, count);
    const result = await new Promise((resolve, reject) => {
      request.onerror = (event) => {
        reject((event.target as IDBRequest).error);
      };
      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result);
      };
    });
    return result as StoreValue<DBTypes, StoreName>[];
  }

  getAllKeys(
    query?: IDBKeyRange | StoreKey<DBTypes, StoreName> | null | undefined,
    count?: number,
  ): Promise<StoreKey<DBTypes, StoreName>[]> {
    throw new Error('Method not implemented.');
  }

  getKey(
    query: IDBKeyRange | StoreKey<DBTypes, StoreName>,
  ): Promise<StoreKey<DBTypes, StoreName> | undefined> {
    throw new Error('Method not implemented.');
  }

  index<IndexName extends IndexNames<DBTypes, StoreName>>(
    name: IndexName,
  ): IDBPIndex<DBTypes, TxStores, StoreName, IndexName, Mode> {
    throw new Error('Method not implemented.');
  }

  openCursor(
    query?: IDBKeyRange | StoreKey<DBTypes, StoreName> | null | undefined,
    direction?: IDBCursorDirection,
  ): Promise<IDBPCursorWithValue<
    DBTypes,
    TxStores,
    StoreName,
    unknown,
    Mode
  > | null> {
    throw new Error('Method not implemented.');
  }

  openKeyCursor(
    query?: IDBKeyRange | StoreKey<DBTypes, StoreName> | null | undefined,
    direction?: IDBCursorDirection,
  ): Promise<IDBPCursor<DBTypes, TxStores, StoreName, unknown, Mode> | null> {
    throw new Error('Method not implemented.');
  }

  iterate(
    query?: IDBKeyRange | StoreKey<DBTypes, StoreName> | null | undefined,
    direction?: IDBCursorDirection,
  ): AsyncIterableIterator<
    IDBPCursorWithValueIteratorValue<
      DBTypes,
      TxStores,
      StoreName,
      unknown,
      Mode
    >
  > {
    throw new Error('Method not implemented.');
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<
    IDBPCursorWithValueIteratorValue<
      DBTypes,
      TxStores,
      StoreName,
      unknown,
      Mode
    >
  > {
    throw new Error('Method not implemented.');
  }

  get autoIncrement(): boolean {
    return this.store.autoIncrement;
  }

  get keyPath(): string | string[] {
    return this.store.keyPath;
  }

  get name(): string {
    return this.store.name;
  }

  deleteIndex(name: string): void {
    this.store.deleteIndex(name);
  }

  add: Mode extends 'readonly'
    ? undefined
    : (
        value: StoreValue<DBTypes, StoreName>,
        key?: StoreKey<DBTypes, StoreName> | IDBKeyRange,
      ) => Promise<StoreKey<DBTypes, StoreName>>;

  put: Mode extends 'readonly'
    ? undefined
    : (
        value: StoreValue<DBTypes, StoreName>,
        key?: StoreKey<DBTypes, StoreName> | IDBKeyRange,
      ) => Promise<StoreKey<DBTypes, StoreName>>;

  delete: Mode extends 'readonly'
    ? undefined
    : (key: StoreKey<DBTypes, StoreName> | IDBKeyRange) => Promise<void>;

  clear: Mode extends 'readonly' ? undefined : () => Promise<void>;

  createIndex: Mode extends 'versionchange'
    ? <IndexName extends IndexNames<DBTypes, StoreName>>(
        name: IndexName,
        keyPath: string | string[],
        options?: IDBIndexParameters,
      ) => IDBPIndex<DBTypes, TxStores, StoreName, IndexName, Mode>
    : undefined;

  constructor({
    tx,
    store,
    mode,
  }: {
    tx: IDBPTransaction<DBTypes, TxStores, Mode>;
    store: IDBObjectStore;
    mode: Mode;
  }) {
    this.transaction = tx;
    this.store = store;
    this.mode = mode;

    this.add =
      this.mode === 'readonly'
        ? (undefined as any)
        : async (
            value: StoreValue<DBTypes, StoreName>,
            key?: StoreKey<DBTypes, StoreName> | IDBKeyRange,
          ): Promise<StoreKey<DBTypes, StoreName>> => {
            const request = this.store.add(value, key as IDBValidKey);
            const result = await new Promise((resolve, reject) => {
              request.onerror = (event) => {
                reject((event.target as IDBRequest).error);
              };
              request.onsuccess = (event) => {
                resolve((event.target as IDBRequest).result);
              };
            });
            return result as StoreKey<DBTypes, StoreName>;
          };

    this.put =
      this.mode === 'readonly'
        ? (undefined as any)
        : async (
            value: StoreValue<DBTypes, StoreName>,
            key?: StoreKey<DBTypes, StoreName> | IDBKeyRange,
          ): Promise<StoreKey<DBTypes, StoreName>> => {
            const request = this.store.put(value, key as IDBValidKey);
            const result = await new Promise((resolve, reject) => {
              request.onerror = (event) => {
                reject((event.target as IDBRequest).error);
              };
              request.onsuccess = (event) => {
                resolve((event.target as IDBRequest).result);
              };
            });
            return result as StoreKey<DBTypes, StoreName>;
          };

    this.delete =
      this.mode === 'readonly'
        ? (undefined as any)
        : (key: StoreKey<DBTypes, StoreName> | IDBKeyRange) => {
            throw new Error('Method not implemented.');
          };

    this.clear =
      this.mode === 'readonly'
        ? (undefined as any)
        : (): Promise<void> => {
            throw new Error('Method not implemented.');
          };

    this.createIndex =
      this.mode === 'versionchange'
        ? <IndexName extends IndexNames<DBTypes, StoreName>>(
            name: IndexName,
            keyPath: string | string[],
            options?: IDBIndexParameters,
          ): IDBPIndex<DBTypes, TxStores, StoreName, IndexName, Mode> => {
            this.store.createIndex(name, keyPath, options);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return undefined as unknown as any;
          }
        : (undefined as any);
  }
}
