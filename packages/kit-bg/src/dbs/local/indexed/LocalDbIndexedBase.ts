import { deleteDB, openDB } from 'idb';
import { difference, isNil } from 'lodash';

import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import {
  DB_MAIN_CONTEXT_ID,
  DEFAULT_VERIFY_STRING,
  INDEXED_DB_NAME,
  INDEXED_DB_VERSION,
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { LocalDbBase } from '../LocalDbBase';
import { ELocalDBStoreNames } from '../localDBStoreNames';

import { IndexedDBAgent } from './IndexedDBAgent';

import type { IDBWalletIdSingleton, IIndexedDBSchemaMap } from '../types';
import type { IDBPDatabase, IDBPObjectStore, IDBPTransaction } from 'idb';

export abstract class LocalDbIndexedBase extends LocalDbBase {
  constructor() {
    super();
    this.readyDb = this._openDb();
  }

  protected override readyDb: Promise<IndexedDBAgent>;

  // ---------------------------------------------- private methods

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async _handleDbUpgrade(options: {
    db: IDBPDatabase<IIndexedDBSchemaMap>;
    oldVersion: number;
    newVersion: number | null;
    transaction: IDBPTransaction<
      IIndexedDBSchemaMap,
      ELocalDBStoreNames[],
      'versionchange'
    >;
  }) {
    const { db, transaction } = options;
    const currentStoreNames = db.objectStoreNames;

    // create new stores
    const storeNamesToAdd = Object.values(ELocalDBStoreNames);
    for (const v of storeNamesToAdd) {
      this._getOrCreateObjectStoreAtVersionChange(db, transaction, v);
    }

    // TODO  migrate old data to new stores

    // delete removed stores
    const storeNamesToRemove = difference(currentStoreNames, storeNamesToAdd);
    for (const name of storeNamesToRemove) {
      db.deleteObjectStore(name);
    }

    return null;
  }

  private async _openDb() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const indexed = await openDB<IIndexedDBSchemaMap>(
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

    const db = new IndexedDBAgent(indexed);
    await this._initDBRecords(db);
    return db;
  }

  private async _addSingletonWalletRecord({
    walletStore,
    walletId,
  }: {
    walletStore: IDBPObjectStore<
      IIndexedDBSchemaMap,
      ELocalDBStoreNames.Wallet[],
      ELocalDBStoreNames.Wallet,
      'readwrite'
    >;
    walletId: IDBWalletIdSingleton;
  }) {
    await this._getOrAddRecord(walletStore, {
      id: walletId,
      name: walletId,
      type: walletId,
      backuped: true,
      accounts: [],
      nextIndex: 0,
      walletNo: 0,
      nextAccountIds: { 'global': 1 },
    });
  }

  private async _initDBRecords(db: IndexedDBAgent) {
    const { tx } = db._buildTransactionAndStores({
      db: db.indexed,
      alwaysCreate: true,
    });
    if (!tx.stores) {
      throw new Error('tx.stores is undefined');
    }
    const { context: contextStore, wallets: walletStore } = tx.stores;
    await Promise.all([
      this._getOrAddRecord(contextStore, {
        id: DB_MAIN_CONTEXT_ID,
        nextHD: 1,
        nextWalletNo: 1,
        verifyString: DEFAULT_VERIFY_STRING,
        backupUUID: generateUUID(),
      }),
      this._addSingletonWalletRecord({
        walletStore,
        walletId: WALLET_TYPE_IMPORTED,
      }),
      this._addSingletonWalletRecord({
        walletStore,
        walletId: WALLET_TYPE_WATCHING,
      }),
      this._addSingletonWalletRecord({
        walletStore,
        walletId: WALLET_TYPE_EXTERNAL,
      }),
    ]);
  }

  private _getObjectStoreAtVersionChange<T extends ELocalDBStoreNames>(
    tx: IDBPTransaction<
      IIndexedDBSchemaMap,
      ELocalDBStoreNames[],
      'versionchange'
    >,
    storeName: T,
  ): IDBPObjectStore<IIndexedDBSchemaMap, T[], T, 'versionchange'> {
    const store = tx.objectStore(storeName);
    return store;
  }

  private _getOrCreateObjectStoreAtVersionChange<T extends ELocalDBStoreNames>(
    db: IDBPDatabase<IIndexedDBSchemaMap>,
    tx: IDBPTransaction<
      IIndexedDBSchemaMap,
      ELocalDBStoreNames[],
      'versionchange'
    >,
    storeName: T,
  ): IDBPObjectStore<IIndexedDBSchemaMap, T[], T, 'versionchange'> {
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

  private async _getOrAddRecord<T extends ELocalDBStoreNames>(
    store: IDBPObjectStore<IIndexedDBSchemaMap, T[], T, 'readwrite'>,
    record: IIndexedDBSchemaMap[T]['value'],
  ): Promise<IIndexedDBSchemaMap[T]['value'] | undefined> {
    /* get store like this
    const store = this._getOrCreateObjectStore(
      db,
      ELocalDBStoreNames.context,
    );
    */
    // @ts-ignore
    const recordId = record.id;
    let existsRecord = await store.get(recordId);
    if (isNil(existsRecord)) {
      await store.add(record);
      existsRecord = await store.get(recordId);
    }
    return existsRecord;
  }

  // ---------------------------------------------- base methods

  // ---------------------------------------------- public methods

  async deleteIndexedDb() {
    const db = await this.readyDb;
    db.indexed.close();
    return deleteDB(INDEXED_DB_NAME);
  }
}
