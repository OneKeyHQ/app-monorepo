import { deleteDB, openDB } from 'idb';
import { difference, isNil } from 'lodash';

import {
  DB_MAIN_CONTEXT_ID,
  DEFAULT_VERIFY_STRING,
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { V4LocalDbBase } from '../V4LocalDbBase';
import {
  V4_INDEXED_DB_NAME,
  V4_INDEXED_DB_VERSION,
  v4storeNameSupportCreatedAt,
} from '../v4localDBConsts';
import { EV4LocalDBStoreNames } from '../v4localDBStoreNames';

import { V4IndexedDBAgent } from './V4IndexedDBAgent';

import type {
  IV4DBWalletIdSingleton,
  IV4IndexedDBSchemaMap,
} from '../v4localDBTypes';
import type { IDBPDatabase, IDBPObjectStore, IDBPTransaction } from 'idb';

export class V4LocalDbIndexed extends V4LocalDbBase {
  constructor() {
    super();
    this.readyDb = this._openDb();
  }

  protected override readyDb: Promise<V4IndexedDBAgent>;

  async reset(): Promise<void> {
    return this.deleteIndexedDb();
  }

  // ---------------------------------------------- private methods

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async _handleDbUpgrade(options: {
    db: IDBPDatabase<IV4IndexedDBSchemaMap>;
    oldVersion: number;
    newVersion: number | null;
    transaction: IDBPTransaction<
      IV4IndexedDBSchemaMap,
      EV4LocalDBStoreNames[],
      'versionchange'
    >;
  }) {
    const { db, transaction } = options;
    const currentStoreNames = db.objectStoreNames;

    // create new stores
    const storeNamesToAdd = Object.values(EV4LocalDBStoreNames);
    for (const v of storeNamesToAdd) {
      this._getOrCreateObjectStoreAtVersionChange(db, transaction, v);
    }

    // TODO  migrate old data to new stores
    // request.onupgradeneeded

    // delete removed stores
    const storeNamesToRemove = difference(currentStoreNames, storeNamesToAdd);
    for (const name of storeNamesToRemove) {
      // removeObjectStore / removeTable
      // db.deleteObjectStore(name);
    }

    return null;
  }

  private async _openDb() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const indexed = await openDB<IV4IndexedDBSchemaMap>(
      V4_INDEXED_DB_NAME,
      V4_INDEXED_DB_VERSION,
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

    const db = new V4IndexedDBAgent(indexed);
    await this._initDBRecords(db);
    return db;
  }

  private async _addSingletonWalletRecord({
    walletStore,
    walletId,
  }: {
    walletStore: IDBPObjectStore<
      IV4IndexedDBSchemaMap,
      EV4LocalDBStoreNames.Wallet[],
      EV4LocalDBStoreNames.Wallet,
      'readwrite'
    >;
    walletId: IV4DBWalletIdSingleton;
  }) {
    await this._getOrAddRecord(
      walletStore,
      this.buildSingletonWalletRecord({
        walletId,
      }),
    );
  }

  private async _initDBRecords(db: V4IndexedDBAgent) {
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

  private _getObjectStoreAtVersionChange<T extends EV4LocalDBStoreNames>(
    tx: IDBPTransaction<
      IV4IndexedDBSchemaMap,
      EV4LocalDBStoreNames[],
      'versionchange'
    >,
    storeName: T,
  ): IDBPObjectStore<IV4IndexedDBSchemaMap, T[], T, 'versionchange'> {
    const store = tx.objectStore(storeName);
    // @ts-ignore
    return store;
  }

  private _getOrCreateObjectStoreAtVersionChange<
    T extends EV4LocalDBStoreNames,
  >(
    db: IDBPDatabase<IV4IndexedDBSchemaMap>,
    tx: IDBPTransaction<
      IV4IndexedDBSchemaMap,
      EV4LocalDBStoreNames[],
      'versionchange'
    >,
    storeName: T,
  ): IDBPObjectStore<IV4IndexedDBSchemaMap, T[], T, 'versionchange'> {
    try {
      const store = this._getObjectStoreAtVersionChange(tx, storeName);
      // const dd = await store.get('');
      return store;
    } catch {
      db.createObjectStore(storeName, {
        keyPath: 'id',
      });
      const store = this._getObjectStoreAtVersionChange(tx, storeName);

      if (v4storeNameSupportCreatedAt.includes(storeName)) {
        // @ts-ignore
        store.createIndex('createdAt', 'createdAt', {
          unique: true,
        });
      }
      return store;
    }
  }

  private async _getOrAddRecord<T extends EV4LocalDBStoreNames>(
    store: IDBPObjectStore<IV4IndexedDBSchemaMap, T[], T, 'readwrite'>,
    record: IV4IndexedDBSchemaMap[T]['value'],
  ): Promise<IV4IndexedDBSchemaMap[T]['value'] | undefined> {
    /* get store like this
    const store = this._getOrCreateObjectStore(
      db,
      EV4LocalDBStoreNames.context,
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
    return deleteDB(V4_INDEXED_DB_NAME);
  }
}
