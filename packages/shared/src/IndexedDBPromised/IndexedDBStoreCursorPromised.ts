/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import indexedDBPromisedUtils from './indexedDBPromisedUtils';

import type {
  // CursorKey,
  // CursorSource,
  DBSchema,
  IDBPCursorWithValue,
  IDBPCursorWithValueIteratorValue,
  IDBPIndex,
  IDBPObjectStore,
  IndexKey,
  IndexNames,
  StoreKey,
  StoreNames,
  StoreValue,
} from 'idb';

declare type ICursorKey<
  DBTypes extends DBSchema | unknown,
  StoreName extends StoreNames<DBTypes>,
  IndexName extends IndexNames<DBTypes, StoreName> | unknown,
> = IndexName extends IndexNames<DBTypes, StoreName>
  ? IndexKey<DBTypes, StoreName, IndexName>
  : StoreKey<DBTypes, StoreName>;
declare type ICursorSource<
  DBTypes extends DBSchema | unknown,
  TxStores extends ArrayLike<StoreNames<DBTypes>>,
  StoreName extends StoreNames<DBTypes>,
  IndexName extends IndexNames<DBTypes, StoreName> | unknown,
  Mode extends IDBTransactionMode = 'readonly',
> = IndexName extends IndexNames<DBTypes, StoreName>
  ? IDBPIndex<DBTypes, TxStores, StoreName, IndexName, Mode>
  : IDBPObjectStore<DBTypes, TxStores, StoreName, Mode>;

export class IndexedDBStoreCursorPromised<
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
> implements IDBPCursorWithValue<DBTypes, TxStores, StoreName, IndexName, Mode>
{
  static async openCursor<
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
  >({
    mode,
    query,
    direction,
    indexOrStore,
  }: {
    mode: Mode;
    indexOrStore: IDBIndex | IDBObjectStore;
    query?:
      | IndexKey<DBTypes, StoreName, IndexName>
      | StoreKey<DBTypes, StoreName>
      | IDBKeyRange
      | null;
    direction?: IDBCursorDirection;
  }): Promise<IDBPCursorWithValue<
    DBTypes,
    TxStores,
    StoreName,
    IndexName,
    Mode
  > | null> {
    const request = indexOrStore.openCursor(query, direction);
    const c = new IndexedDBStoreCursorPromised({
      mode,
      request,
    });
    await c.waitPromise;
    if (c.nativeCursor === null) {
      return null;
    }
    return c as unknown as IDBPCursorWithValue<
      DBTypes,
      TxStores,
      StoreName,
      IndexName,
      Mode
    >;
  }

  constructor({
    mode,
    request,
  }: {
    mode: Mode;
    request: IDBRequest<IDBCursorWithValue | null>;
  }) {
    this.resetWaitPromise();

    request.onerror = (event) => {
      const target = event.target as IDBRequest<IDBCursorWithValue | null>;
      // const target = request;

      this.rejectReady?.(
        target?.error || indexedDBPromisedUtils.newRequestError(),
      );
    };
    request.onsuccess = (event) => {
      const target = event.target as IDBRequest<IDBCursorWithValue | null>;
      // const target = request;

      const cursor = target?.result;
      this.nativeCursor = cursor;
      this.resolveReady?.(true);
    };

    this.delete =
      mode === 'readonly'
        ? (undefined as any)
        : async (): Promise<void> => {
            if (!this.nativeCursor) {
              throw new OneKeyLocalError('nativeCursor is null');
            }
            const deleteRequest = this.nativeCursor.delete();
            await indexedDBPromisedUtils.toPromiseResult({
              request: deleteRequest,
            });
          };

    this.update =
      mode === 'readonly'
        ? (undefined as any)
        : async (
            value: StoreValue<DBTypes, StoreName>,
          ): Promise<StoreKey<DBTypes, StoreName>> => {
            if (!this.nativeCursor) {
              throw new OneKeyLocalError('nativeCursor is null');
            }
            const updateRequest = this.nativeCursor.update(
              value,
            ) as unknown as IDBRequest<StoreKey<DBTypes, StoreName>>;
            return indexedDBPromisedUtils.toPromiseResult({
              request: updateRequest,
            });
          };
  }

  delete: Mode extends 'readonly' ? undefined : () => Promise<void>;

  update: Mode extends 'readonly'
    ? undefined
    : (
        value: StoreValue<DBTypes, StoreName>,
      ) => Promise<StoreKey<DBTypes, StoreName>>;

  nativeCursor: IDBCursorWithValue | null = null;

  waitPromise!: Promise<boolean>;

  resolveReady: ((value: boolean) => void) | null = null;

  rejectReady: ((error: Error | DOMException | null) => void) | null = null;

  resetWaitPromise() {
    this.waitPromise = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
  }

  get value(): StoreValue<DBTypes, StoreName> {
    return this.nativeCursor?.value;
  }

  get key(): ICursorKey<DBTypes, StoreName, IndexName> {
    if (!this.nativeCursor) {
      throw new OneKeyLocalError('nativeCursor is null');
    }
    return this.nativeCursor?.key as ICursorKey<DBTypes, StoreName, IndexName>;
  }

  get primaryKey(): StoreKey<DBTypes, StoreName> {
    if (!this.nativeCursor) {
      throw new OneKeyLocalError('nativeCursor is null');
    }
    return this.nativeCursor?.primaryKey as StoreKey<DBTypes, StoreName>;
  }

  get direction(): IDBCursorDirection {
    if (!this.nativeCursor) {
      throw new OneKeyLocalError('nativeCursor is null');
    }
    return this.nativeCursor.direction;
  }

  get request(): IDBRequest<StoreValue<DBTypes, StoreName>> {
    if (!this.nativeCursor) {
      throw new OneKeyLocalError('nativeCursor is null');
    }
    return this.nativeCursor.request as IDBRequest<
      StoreValue<DBTypes, StoreName>
    >;
  }

  get source(): ICursorSource<DBTypes, TxStores, StoreName, IndexName, Mode> {
    if (!this.nativeCursor) {
      throw new OneKeyLocalError('nativeCursor is null');
    }
    return this.nativeCursor.source as unknown as ICursorSource<
      DBTypes,
      TxStores,
      StoreName,
      IndexName,
      Mode
    >;
  }

  async _callNativeCursorFn<T>(
    fn: (cursor: IDBCursorWithValue) => void,
  ): Promise<T | null> {
    await this.waitPromise;
    if (this.nativeCursor === null) {
      return null;
    }

    this.resetWaitPromise();
    fn(this.nativeCursor);

    await this.waitPromise;
    if (this.nativeCursor === null) {
      return null;
    }
    return this as unknown as T;
  }

  async advance<T>(count: number): Promise<T | null> {
    return this._callNativeCursorFn((cursor) => {
      cursor.advance(count);
    });
  }

  async continue<T>(
    key?: ICursorKey<DBTypes, StoreName, IndexName>,
  ): Promise<T | null> {
    return this._callNativeCursorFn((cursor) => {
      cursor.continue(key);
    });
  }

  async continuePrimaryKey<T>(
    key: ICursorKey<DBTypes, StoreName, IndexName>,
    primaryKey: StoreKey<DBTypes, StoreName>,
  ): Promise<T | null> {
    return this._callNativeCursorFn((cursor) => {
      cursor.continuePrimaryKey(key, primaryKey);
    });
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
}
