import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import storageChecker from '../storageChecker/storageChecker';

import { IndexedDBObjectStorePromised } from './IndexedDBObjectStorePromised';
import indexedDBPromisedUtils from './indexedDBPromisedUtils';

import type { IndexedDBPromised } from './IndexedDBPromised';
import type {
  DBSchema,
  IDBPObjectStore,
  IDBPTransaction,
  StoreNames,
  TypedDOMStringList,
} from 'idb';

export class IndexedDBTransactionPromised<
  DBTypes extends DBSchema | unknown = unknown,
  TxStores extends ArrayLike<StoreNames<DBTypes>> = ArrayLike<
    StoreNames<DBTypes>
  >,
  Mode extends IDBTransactionMode = 'readonly',
> implements IDBPTransaction<DBTypes, TxStores, Mode>
{
  constructor({
    db,
    mode,
    tx,
  }: {
    db: IndexedDBPromised<DBTypes>;
    mode: Mode;
    tx: IDBTransaction;
  }) {
    this.db = db;
    this.nativeTx = tx;
    this.mode = mode;

    const done = new Promise<void>((resolve, reject) => {
      // eslint-disable-next-line prefer-const
      let unListen: (() => void) | undefined;

      const complete = () => {
        resolve();
        unListen?.();
      };

      const error = () => {
        const err = tx.error || indexedDBPromisedUtils.newAbortError();
        storageChecker.handleDiskFullError(err);
        reject(err);
        unListen?.();
      };

      unListen = () => {
        tx.removeEventListener('complete', complete);
        tx.removeEventListener('error', error);
        tx.removeEventListener('abort', error);
      };

      tx.addEventListener('complete', complete);
      tx.addEventListener('error', error);
      tx.addEventListener('abort', error);
    });

    this.done = done;
  }

  readonly nativeTx: IDBTransaction;

  readonly mode: Mode;

  get objectStoreNames(): TypedDOMStringList<TxStores[number]> {
    return this.nativeTx.objectStoreNames as TypedDOMStringList<
      TxStores[number]
    >;
  }

  readonly db: IndexedDBPromised<DBTypes>;

  readonly done: Promise<void>;

  get store(): TxStores[1] extends undefined
    ? IDBPObjectStore<DBTypes, TxStores, TxStores[0], Mode>
    : undefined {
    throw new OneKeyLocalError(
      'use IndexedDBTransactionPromised.objectStore(name) to get a specific store',
    );
  }

  objectStore<StoreName extends TxStores[number]>(
    name: StoreName,
  ): IndexedDBObjectStorePromised<DBTypes, TxStores, StoreName, Mode> {
    // eslint-disable-next-line no-useless-catch
    try {
      const store = this.nativeTx.objectStore(name);
      return new IndexedDBObjectStorePromised({
        tx: this,
        store,
        mode: this.mode,
      });
    } catch (error) {
      // console.error((error as Error)?.message, {
      //   storeName: name,
      //   dbName: this?.nativeTx?.db?.name,
      //   txStoreNames: this?.nativeTx?.objectStoreNames,
      // });

      throw error;
    }
  }

  onabort: ((this: IDBTransaction, ev: Event) => any) | null = null;

  oncomplete: ((this: IDBTransaction, ev: Event) => any) | null = null;

  onerror: ((this: IDBTransaction, ev: Event) => any) | null = null;

  abort(): void {
    this.nativeTx.abort();
  }

  commit(): void {
    this.nativeTx.commit();
  }

  addEventListener<K extends keyof IDBTransactionEventMap>(
    type: K,
    listener: (this: IDBTransaction, ev: IDBTransactionEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
  ): void {
    this.nativeTx.addEventListener(type, listener, options);
  }

  removeEventListener<K extends keyof IDBTransactionEventMap>(
    type: K,
    listener: (this: IDBTransaction, ev: IDBTransactionEventMap[K]) => any,
    options?: boolean | EventListenerOptions,
  ): void {
    this.nativeTx.removeEventListener(type, listener, options);
  }

  get durability(): IDBTransactionDurability {
    return this.nativeTx.durability;
  }

  get error(): DOMException | null {
    return this.nativeTx.error;
  }

  dispatchEvent(event: Event): boolean {
    return this.nativeTx.dispatchEvent(event);
  }
}
