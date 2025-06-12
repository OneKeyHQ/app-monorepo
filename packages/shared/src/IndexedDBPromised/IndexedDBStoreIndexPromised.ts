/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import indexedDBPromisedUtils from './indexedDBPromisedUtils';
import { IndexedDBStoreCursorPromised } from './IndexedDBStoreCursorPromised';

import type { IndexedDBObjectStorePromised } from './IndexedDBObjectStorePromised';
import type {
  DBSchema,
  IDBPCursor,
  IDBPCursorWithValue,
  IDBPCursorWithValueIteratorValue,
  IDBPIndex,
  IndexKey,
  IndexNames,
  StoreKey,
  StoreNames,
  StoreValue,
} from 'idb';

export class IndexedDBStoreIndexPromised<
  DBTypes extends DBSchema | unknown = unknown,
  TxStores extends ArrayLike<StoreNames<DBTypes>> = ArrayLike<
    StoreNames<DBTypes>
  >,
  StoreName extends StoreNames<DBTypes> = StoreNames<DBTypes>,
  IndexName extends IndexNames<DBTypes, StoreName> = IndexNames<
    DBTypes,
    StoreName
  >,
  Mode extends IDBTransactionMode = 'readonly',
> implements IDBPIndex<DBTypes, TxStores, StoreName, IndexName, Mode>
{
  index: IDBIndex;

  objectStore: IndexedDBObjectStorePromised<DBTypes, TxStores, StoreName, Mode>;

  constructor({
    index,
    store,
  }: {
    index: IDBIndex;
    store: IndexedDBObjectStorePromised<DBTypes, TxStores, StoreName, Mode>;
  }) {
    this.index = index;
    this.objectStore = store;
  }

  async count(
    key?: IndexKey<DBTypes, StoreName, IndexName> | IDBKeyRange | null,
  ): Promise<number> {
    const request = this.index.count(key as IDBValidKey | IDBKeyRange);
    return indexedDBPromisedUtils.toPromiseResult({ request });
  }

  async get(
    query: IndexKey<DBTypes, StoreName, IndexName> | IDBKeyRange,
  ): Promise<StoreValue<DBTypes, StoreName> | undefined> {
    const request = this.index.get(query);
    return indexedDBPromisedUtils.toPromiseResult({ request });
  }

  async getAll(
    query?: IndexKey<DBTypes, StoreName, IndexName> | IDBKeyRange | null,
    count?: number,
  ): Promise<StoreValue<DBTypes, StoreName>[]> {
    const request = this.index.getAll(query, count);
    return indexedDBPromisedUtils.toPromiseResult({ request });
  }

  async getAllKeys(
    query?: IndexKey<DBTypes, StoreName, IndexName> | IDBKeyRange | null,
    count?: number,
  ): Promise<StoreKey<DBTypes, StoreName>[]> {
    const request = this.index.getAllKeys(
      query,
      count,
    ) as unknown as IDBRequest<StoreKey<DBTypes, StoreName>[]>;
    return indexedDBPromisedUtils.toPromiseResult({ request });
  }

  async getKey(
    query: IndexKey<DBTypes, StoreName, IndexName> | IDBKeyRange,
  ): Promise<StoreKey<DBTypes, StoreName> | undefined> {
    const request = this.index.getKey(query) as unknown as IDBRequest<
      StoreKey<DBTypes, StoreName> | undefined
    >;
    return indexedDBPromisedUtils.toPromiseResult({ request });
  }

  async openCursor(
    query?: IndexKey<DBTypes, StoreName, IndexName> | IDBKeyRange | null,
    direction?: IDBCursorDirection,
  ): Promise<IDBPCursorWithValue<
    DBTypes,
    TxStores,
    StoreName,
    IndexName,
    Mode
  > | null> {
    return IndexedDBStoreCursorPromised.openCursor({
      mode: this.objectStore.mode,
      indexOrStore: this.index,
      query,
      direction,
    });
  }

  async openKeyCursor(
    query?: IndexKey<DBTypes, StoreName, IndexName> | IDBKeyRange | null,
    direction?: IDBCursorDirection,
  ): Promise<IDBPCursor<DBTypes, TxStores, StoreName, IndexName, Mode> | null> {
    throw new OneKeyLocalError('Method not implemented.');
  }

  iterate(
    query?: IndexKey<DBTypes, StoreName, IndexName> | IDBKeyRange | null,
    direction?: IDBCursorDirection,
  ): AsyncIterableIterator<
    IDBPCursorWithValueIteratorValue<
      DBTypes,
      TxStores,
      StoreName,
      IndexName,
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
      IndexName,
      Mode
    >
  > {
    throw new OneKeyLocalError('Method not implemented.');
  }

  get keyPath(): string | string[] {
    return this.index.keyPath;
  }

  get name(): string {
    return this.index.name;
  }

  get multiEntry(): boolean {
    return this.index.multiEntry;
  }

  get unique(): boolean {
    return this.index.unique;
  }
}
