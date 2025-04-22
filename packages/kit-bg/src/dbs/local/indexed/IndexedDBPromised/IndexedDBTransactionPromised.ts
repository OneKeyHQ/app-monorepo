import { IndexedDBObjectStorePromised } from './IndexedDBObjectStorePromised';

import type {
  DBSchema,
  IDBPDatabase,
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
    storeNames,
    mode,
    tx,
  }: {
    db: IDBPDatabase<DBTypes>;
    storeNames: ArrayLike<StoreNames<DBTypes>>;
    mode: Mode;
    tx: IDBTransaction;
  }) {
    this.db = db;
    this.tx = tx;
    this.mode = mode;
    // @ts-ignore
    this.objectStoreNames = Array.from(storeNames);
  }

  readonly tx: IDBTransaction;

  readonly mode: Mode;

  readonly objectStoreNames: TypedDOMStringList<TxStores[number]>;

  readonly db: IDBPDatabase<DBTypes>;

  get done(): Promise<void> {
    return new Promise((resolve, reject) => {
      reject(
        new Error('IndexedDBTransactionPromised.done Method not implemented.'),
      );
    });
  }

  readonly store = undefined as any;

  objectStore<StoreName extends TxStores[number]>(
    name: StoreName,
  ): IDBPObjectStore<DBTypes, TxStores, StoreName, Mode> {
    const store = this.tx.objectStore(name);
    return new IndexedDBObjectStorePromised({
      tx: this,
      store,
      mode: this.mode,
    });
  }

  onabort: ((this: IDBTransaction, ev: Event) => any) | null = null;

  oncomplete: ((this: IDBTransaction, ev: Event) => any) | null = null;

  onerror: ((this: IDBTransaction, ev: Event) => any) | null = null;

  abort(): void {
    this.tx.abort();
  }

  commit(): void {
    this.tx.commit();
  }

  addEventListener<K extends keyof IDBTransactionEventMap>(
    type: K,
    listener: (this: IDBTransaction, ev: IDBTransactionEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
  ): void {
    this.tx.addEventListener(type, listener, options);
  }

  removeEventListener<K extends keyof IDBTransactionEventMap>(
    type: K,
    listener: (this: IDBTransaction, ev: IDBTransactionEventMap[K]) => any,
    options?: boolean | EventListenerOptions,
  ): void {
    this.tx.removeEventListener(type, listener, options);
  }

  get durability(): IDBTransactionDurability {
    return this.tx.durability;
  }

  get error(): DOMException | null {
    return this.tx.error;
  }

  dispatchEvent(event: Event): boolean {
    return this.tx.dispatchEvent(event);
  }
}
