import { deleteDB, openDB } from 'idb';
import { difference, isNil } from 'lodash';

import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { LocalDbBase } from '../LocalDbBase';
import {
  DB_MAIN_CONTEXT_ID,
  DEFAULT_VERIFY_STRING,
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '../types';

import {
  EIndexedDBStoreNames,
  INDEXED_DB_NAME,
  INDEXED_DB_VERSION,
} from './types';

import type { IIndexedDBSchema } from './types';
import type { IDBPDatabase, IDBPObjectStore, IDBPTransaction } from 'idb';

export abstract class LocalDbIndexedBase extends LocalDbBase {
  constructor() {
    super();
    this.readyDb = this._openIndexedDb();
  }

  readyDb: Promise<IDBPDatabase<IIndexedDBSchema>>;

  // ---------------------------------------------- private methods

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async _handleDbUpgrade(options: {
    db: IDBPDatabase<IIndexedDBSchema>;
    oldVersion: number;
    newVersion: number | null;
    transaction: IDBPTransaction<
      IIndexedDBSchema,
      EIndexedDBStoreNames[],
      'versionchange'
    >;
  }) {
    const { db, transaction } = options;
    const currentStoreNames = db.objectStoreNames;

    // create new stores
    const storeNamesToAdd = Object.values(EIndexedDBStoreNames);
    for (const v of storeNamesToAdd) {
      this._getOrCreateObjectStoreAtVersionChange(db, transaction, v);
    }

    // delete removed stores
    const storeNamesToRemove = difference(currentStoreNames, storeNamesToAdd);
    for (const name of storeNamesToRemove) {
      db.deleteObjectStore(name);
    }

    return null;
  }

  private async _openIndexedDb() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const db = await openDB<IIndexedDBSchema>(
      INDEXED_DB_NAME,
      INDEXED_DB_VERSION,
      {
        upgrade(db0, oldVersion, newVersion, transaction) {
          // add object stores here
          return self._handleDbUpgrade({
            db: db0,
            oldVersion,
            newVersion,
            transaction,
          });
        },
      },
    );

    // add initial records to store
    await this._getOrAddRecord(db, EIndexedDBStoreNames.context, {
      id: DB_MAIN_CONTEXT_ID,
      nextHD: 1,
      verifyString: DEFAULT_VERIFY_STRING,
      backupUUID: generateUUID(),
    });
    await this._addSingletonWallets(db);

    return db;
  }

  private async _addSingletonWalletEntry({
    objectStore,
    walletId,
  }: {
    objectStore: IDBPObjectStore<
      IIndexedDBSchema,
      EIndexedDBStoreNames.wallets[],
      EIndexedDBStoreNames.wallets,
      'readwrite'
    >;
    walletId:
      | typeof WALLET_TYPE_IMPORTED
      | typeof WALLET_TYPE_WATCHING
      | typeof WALLET_TYPE_EXTERNAL;
  }) {
    const wallet = await objectStore.get(walletId);
    if (isNil(wallet)) {
      await objectStore.add({
        id: walletId,
        name: walletId,
        type: walletId,
        backuped: true,
        accounts: [],
        nextAccountIds: { 'global': 1 },
      });
    }
  }

  private async _addSingletonWallets(db: IDBPDatabase<IIndexedDBSchema>) {
    const tx = db.transaction(
      [
        // EIndexedDBStoreNames.accounts,
        EIndexedDBStoreNames.wallets,
      ],
      'readwrite',
    );
    // const accountStore = tx.objectStore(EIndexedDBStoreNames.accounts);
    const walletStore = tx.objectStore(EIndexedDBStoreNames.wallets);
    await Promise.all([
      this._addSingletonWalletEntry({
        objectStore: walletStore,
        walletId: WALLET_TYPE_IMPORTED,
      }),
      this._addSingletonWalletEntry({
        objectStore: walletStore,
        walletId: WALLET_TYPE_WATCHING,
      }),
      this._addSingletonWalletEntry({
        objectStore: walletStore,
        walletId: WALLET_TYPE_EXTERNAL,
      }),
    ]);
  }

  private _getObjectStoreAtVersionChange<T extends EIndexedDBStoreNames>(
    tx: IDBPTransaction<
      IIndexedDBSchema,
      EIndexedDBStoreNames[],
      'versionchange'
    >,
    storeName: T,
  ): IDBPObjectStore<IIndexedDBSchema, T[], T, 'versionchange'> {
    const store = tx.objectStore(storeName);
    return store;
  }

  private _getOrCreateObjectStoreAtVersionChange<
    T extends EIndexedDBStoreNames,
  >(
    db: IDBPDatabase<IIndexedDBSchema>,
    tx: IDBPTransaction<
      IIndexedDBSchema,
      EIndexedDBStoreNames[],
      'versionchange'
    >,
    storeName: T,
  ): IDBPObjectStore<IIndexedDBSchema, T[], T, 'versionchange'> {
    try {
      const store = this._getObjectStoreAtVersionChange(tx, storeName);
      // const dd = await store.get('');
      return store;
    } catch {
      db.createObjectStore(storeName, {
        keyPath: 'id',
      });
      const store = this._getObjectStoreAtVersionChange(tx, storeName);
      return store;
    }
  }

  private _getObjectStore<T extends EIndexedDBStoreNames>(
    db: IDBPDatabase<IIndexedDBSchema>,
    storeName: T,
  ): IDBPObjectStore<IIndexedDBSchema, T[], T, 'readwrite'> {
    const tx = db.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    return store;
  }

  private _getOrCreateObjectStore<T extends EIndexedDBStoreNames>(
    db: IDBPDatabase<IIndexedDBSchema>,
    storeName: T,
  ): IDBPObjectStore<IIndexedDBSchema, T[], T, 'readwrite'> {
    try {
      const store = this._getObjectStore(db, storeName);
      // const dd = await store.get('');
      return store;
    } catch {
      db.createObjectStore(storeName, {
        keyPath: 'id',
      });
      const store = this._getObjectStore(db, storeName);
      return store;
    }
  }

  private async _getOrAddRecord<T extends EIndexedDBStoreNames>(
    db: IDBPDatabase<IIndexedDBSchema>,
    storeName: T,
    record: IIndexedDBSchema[T]['value'],
  ): Promise<IIndexedDBSchema[T]['value'] | undefined> {
    const store = this._getOrCreateObjectStore(db, storeName);
    // @ts-ignore
    const recordId = record.id;
    let existsRecord = await store.get(recordId);
    if (isNil(existsRecord)) {
      await store.add(record);
      existsRecord = await store.get(recordId);
    }
    return existsRecord;
  }

  // ---------------------------------------------- public methods

  async deleteIndexedDb() {
    const db = await this.readyDb;
    db.close();
    return deleteDB(INDEXED_DB_NAME);
  }

  async getObjectStore<T extends EIndexedDBStoreNames>(
    storeName: T,
  ): Promise<IDBPObjectStore<IIndexedDBSchema, T[], T, 'readwrite'>> {
    const db = await this.readyDb;
    return this._getOrCreateObjectStore(db, storeName);
  }

  async getRecordById<T extends EIndexedDBStoreNames>(
    storeName: T,
    recordId: string,
  ): Promise<IIndexedDBSchema[T]['value'] | undefined> {
    const db = await this.readyDb;
    const store = this._getOrCreateObjectStore(db, storeName);
    const existsRecord = await store.get(recordId);
    return existsRecord;
  }
}

// function startTransaction<T extends EIndexedDBStoreNames[]>(
//   db: IDBPDatabase<OneKeyDBSchema>,
//   storeNames: T,
// ) {
//   const tx = db.transaction(storeNames, 'readwrite');
//   const result = storeNames.map(
//     (storeName, i) =>
//       tx.objectStore(storeName) as IDBPObjectStore<
//         OneKeyDBSchema,
//         T,
//         Extract<T[number], string>,
//         'readwrite'
//       >,
//   );
//   return result;
// }

// const [a, b] = startTransaction({} as any, [
//   EIndexedDBStoreNames.context,
//   EIndexedDBStoreNames.accounts,
// ]);
