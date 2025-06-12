/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import indexedDBPromisedUtils from './indexedDBPromisedUtils';
import { IndexedDBStoreCursorPromised } from './IndexedDBStoreCursorPromised';
import { IndexedDBStoreIndexPromised } from './IndexedDBStoreIndexPromised';

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
    return indexedDBPromisedUtils.toPromiseResult({ request });
  }

  async get(
    query: IDBKeyRange | StoreKey<DBTypes, StoreName>,
  ): Promise<StoreValue<DBTypes, StoreName> | undefined> {
    try {
      const request = this.store.get(query);
      return await indexedDBPromisedUtils.toPromiseResult({ request });
    } catch (error) {
      const e = error as Error | undefined;
      if (
        e?.message?.includes(
          `Failed to execute 'get' on 'IDBObjectStore': The transaction has finished`,
        )
      ) {
        console.log('db transaction finished');
      }
      throw error;
    }
  }

  async getAll(
    query?: IDBKeyRange | StoreKey<DBTypes, StoreName> | null | undefined,
    count?: number,
  ): Promise<StoreValue<DBTypes, StoreName>[]> {
    const request = this.store.getAll(query, count);
    return indexedDBPromisedUtils.toPromiseResult({ request });
  }

  getAllKeys(
    query?: IDBKeyRange | StoreKey<DBTypes, StoreName> | null | undefined,
    count?: number,
  ): Promise<StoreKey<DBTypes, StoreName>[]> {
    const request = this.store.getAllKeys(
      query,
      count,
    ) as unknown as IDBRequest<StoreKey<DBTypes, StoreName>[]>;
    return indexedDBPromisedUtils.toPromiseResult({ request });
  }

  getKey(
    query: IDBKeyRange | StoreKey<DBTypes, StoreName>,
  ): Promise<StoreKey<DBTypes, StoreName> | undefined> {
    const request = this.store.getKey(query) as unknown as IDBRequest<
      StoreKey<DBTypes, StoreName> | undefined
    >;
    return indexedDBPromisedUtils.toPromiseResult({ request });
  }

  index<IndexName extends IndexNames<DBTypes, StoreName>>(
    name: IndexName,
  ): IndexedDBStoreIndexPromised<
    DBTypes,
    TxStores,
    StoreName,
    IndexName,
    Mode
  > {
    const index = this.store.index(name);
    return new IndexedDBStoreIndexPromised({
      store: this,
      index,
    });
  }

  async openCursor(
    query?: IDBKeyRange | StoreKey<DBTypes, StoreName> | null | undefined,
    direction?: IDBCursorDirection,
  ): Promise<IDBPCursorWithValue<
    DBTypes,
    TxStores,
    StoreName,
    unknown,
    Mode
  > | null> {
    return IndexedDBStoreCursorPromised.openCursor({
      mode: this.mode,
      indexOrStore: this.store,
      query,
      direction,
    });
  }

  openKeyCursor(
    query?: IDBKeyRange | StoreKey<DBTypes, StoreName> | null | undefined,
    direction?: IDBCursorDirection,
  ): Promise<IDBPCursor<DBTypes, TxStores, StoreName, unknown, Mode> | null> {
    throw new OneKeyLocalError('Method not implemented.');
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
    throw new OneKeyLocalError('Method not implemented.');
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
    throw new OneKeyLocalError('Method not implemented.');
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
            const request = this.store.add(
              value,
              key as IDBValidKey,
            ) as unknown as IDBRequest<StoreKey<DBTypes, StoreName>>;
            return indexedDBPromisedUtils.toPromiseResult({ request });
          };

    this.put =
      this.mode === 'readonly'
        ? (undefined as any)
        : async (
            value: StoreValue<DBTypes, StoreName>,
            key?: StoreKey<DBTypes, StoreName> | IDBKeyRange,
          ): Promise<StoreKey<DBTypes, StoreName>> => {
            const request = this.store.put(
              value,
              key as IDBValidKey,
            ) as unknown as IDBRequest<StoreKey<DBTypes, StoreName>>;
            return indexedDBPromisedUtils.toPromiseResult({ request });
          };

    this.delete =
      this.mode === 'readonly'
        ? (undefined as any)
        : async (
            key: StoreKey<DBTypes, StoreName> | IDBKeyRange,
          ): Promise<void> => {
            const request = this.store.delete(key as IDBValidKey);
            await indexedDBPromisedUtils.toPromiseResult({ request });
          };

    this.clear =
      this.mode === 'readonly'
        ? (undefined as any)
        : async (): Promise<void> => {
            const request = this.store.clear();
            await indexedDBPromisedUtils.toPromiseResult({ request });
          };

    this.createIndex =
      this.mode === 'versionchange'
        ? <IndexName extends IndexNames<DBTypes, StoreName>>(
            name: IndexName,
            keyPath: string | string[],
            options?: IDBIndexParameters,
          ): IDBPIndex<DBTypes, TxStores, StoreName, IndexName, Mode> => {
            const index = this.store.createIndex(name, keyPath, options);
            // return 111;
            return new IndexedDBStoreIndexPromised({
              store: this,
              index,
            });
          }
        : (undefined as any);
  }
}
