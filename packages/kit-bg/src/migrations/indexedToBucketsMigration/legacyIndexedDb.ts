import {
  type IDBPDatabase,
  type IDBPObjectStore,
  type IDBPTransaction,
  openDB,
} from 'idb';

import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';

import {
  INDEXED_DB_VERSION,
  LEGACY_INDEXED_DB_NAME,
  storeNameSupportCreatedAt,
} from '../../dbs/local/consts';
import { ELocalDBStoreNames } from '../../dbs/local/localDBStoreNames';

import type { IIndexedDBSchemaMap } from '../../dbs/local/types';

class LegacyIndexedDb {
  legacyDb!: Promise<IDBPDatabase<IIndexedDBSchemaMap>>;

  async open(): Promise<IDBPDatabase<IIndexedDBSchemaMap>> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (!this.legacyDb) {
      // eslint-disable-next-line no-async-promise-executor
      this.legacyDb = new Promise(async (resolve) => {
        const legacyDb = await openDB<IIndexedDBSchemaMap>(
          LEGACY_INDEXED_DB_NAME,
          INDEXED_DB_VERSION,
          {
            upgrade: (db, oldVersion, newVersion, transaction) => {
              this._handleDbUpgrade({
                db,
                oldVersion,
                newVersion,
                transaction,
              });
            },
          },
        );
        resolve(legacyDb);
      });
    }

    return this.legacyDb;
  }

  async count(name: ELocalDBStoreNames) {
    try {
      const legacyDb = await this.open();
      return await legacyDb.count(name);
    } catch (error) {
      console.error(error);
      return 0;
    }
  }

  async getAll<T extends ELocalDBStoreNames>(name: T) {
    try {
      const legacyDb = await this.open();
      return await legacyDb.getAll(name);
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  async delete(name: ELocalDBStoreNames, id: string) {
    try {
      const legacyDb = await this.open();
      await legacyDb.delete(name, id);
    } catch (error) {
      console.error(error);
    }
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
    // @ts-ignore
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
    } catch (error) {
      errorUtils.autoPrintErrorIgnore(error);
      db.createObjectStore(storeName, {
        keyPath: 'id',
      });
      const store = this._getObjectStoreAtVersionChange(tx, storeName);
      if (storeNameSupportCreatedAt.includes(storeName)) {
        // @ts-ignore
        store.createIndex('createdAt', 'createdAt', {
          unique: true,
        });
      }
      return store;
    }
  }

  private _handleDbUpgrade(options: {
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

    // create new stores
    const storeNamesToAdd = Object.values(ELocalDBStoreNames);
    for (const v of storeNamesToAdd) {
      this._getOrCreateObjectStoreAtVersionChange(db, transaction, v);
    }

    // TODO  migrate old data to new stores
    const oldVersion = options.oldVersion || 0;

    // init db
    if (oldVersion < 1) {
      // initDb(db);
    }

    // create device store
    if (oldVersion < 2) {
      // db.createObjectStore(DEVICE_STORE_NAME, { keyPath: 'id' });
    }

    // update network rpc
    if (oldVersion < 5) {
      // const transaction = versionChangedEvent.target // @ts-expect-error
      //   .transaction as IDBTransaction;
      // const openCursorRequest = transaction
      //   .objectStore(NETWORK_STORE_NAME)
      //   .openCursor();
      // openCursorRequest.onsuccess = (_cursorEvent) => {
      //   const cursor = openCursorRequest.result as IDBCursorWithValue;
      //   if (cursor) {
      //     const network = cursor.value as DBNetwork;
      //     const toClear = DEFAULT_RPC_ENDPOINT_TO_CLEAR[network.id];
      //     if (!isNil(toClear) && network.rpcURL === toClear) {
      //       network.rpcURL = '';
      //       cursor.update(network);
      //     }
      //     cursor.continue();
      //   }
      // };
    }

    // create account derivation store
    if (oldVersion < 7) {
      // db.createObjectStore(ACCOUNT_DERIVATION_STORE_NAME, {
      //   keyPath: 'id',
      // });
    }

    // create fee store
    if (oldVersion < 8) {
      // db.createObjectStore(CUSTOM_FEE_STORE_NAME, {
      //   keyPath: 'id',
      // });
    }

    // delete removed stores
    // const storeNamesToRemove = difference(currentStoreNames, storeNamesToAdd);
    // for (const name of storeNamesToRemove) {
    //   db.deleteObjectStore(name);
    // }

    return null;
  }
}

export default new LegacyIndexedDb();
