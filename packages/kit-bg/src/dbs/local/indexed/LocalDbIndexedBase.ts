import { isNil } from 'lodash';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import {
  DB_MAIN_CONTEXT_ID,
  DEFAULT_VERIFY_STRING,
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import {
  ENABLE_INDEXEDDB_BUCKET,
  INDEXED_DB_NAME,
  INDEXED_DB_VERSION,
  storeNameSupportCreatedAt,
} from '../consts';
import { LocalDbBase } from '../LocalDbBase';
import { ELocalDBStoreNames } from '../localDBStoreNames';
import {
  EIndexedDBBucketNames,
  type IDBWalletIdSingleton,
  type IIndexedDBSchemaMap,
} from '../types';

import { IndexedDBAgent } from './IndexedDBAgent';
import { IndexedDBPromised } from './IndexedDBPromised';
import indexedUtils from './indexedUtils';

import type { IndexedDBObjectStorePromised } from './IndexedDBPromised';
import type { IDBPDatabase, IDBPObjectStore, IDBPTransaction } from 'idb';

export abstract class LocalDbIndexedBase extends LocalDbBase {
  constructor() {
    super();
    this.readyDb = this._openDb();
  }

  protected override readyDb: Promise<IndexedDBAgent>;

  // ---------------------------------------------- private methods

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _handleDbUpgrade(options: {
    bucketName: EIndexedDBBucketNames;
    db: IndexedDBPromised<IIndexedDBSchemaMap>;
    nativeDB: IDBDatabase;
    oldVersion: number;
    newVersion: number | null;
    transaction: IDBPTransaction<
      IIndexedDBSchemaMap,
      ELocalDBStoreNames[],
      'versionchange'
    >;
  }): null {
    const { db, transaction, newVersion, bucketName, nativeDB } = options;
    const currentStoreNames = db.objectStoreNames;

    // create new stores
    const storeNamesToAdd = Object.values(ELocalDBStoreNames);
    for (const storeName of storeNamesToAdd) {
      this._getOrCreateObjectStoreAtVersionChange({
        db,
        nativeDB,
        tx: transaction,
        storeName,
        bucketName,
      });
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
      // const transaction = versionChangedEvent.target
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

  buildDbName(bucketName: EIndexedDBBucketNames) {
    return INDEXED_DB_NAME(bucketName);
  }

  private async _openDb() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    const buckets: Record<
      EIndexedDBBucketNames,
      IndexedDBPromised<IIndexedDBSchemaMap>
    > = {
      [EIndexedDBBucketNames.account]: undefined as any,
      [EIndexedDBBucketNames.address]: undefined as any,
      [EIndexedDBBucketNames.archive]: undefined as any,
    };

    const bucketNames = Object.values(EIndexedDBBucketNames);

    for (const bucketName of bucketNames) {
      // let idb = globalThis.indexedDB;
      // if (ENABLE_INDEXEDDB_BUCKET) {
      //   const bucketOptions: IStorageBucketOptions = {
      //     durability: 'strict', // Or `'relaxed'`.
      //     persisted: true, // Or `false`.
      //   };
      //   const storageBuckets = (globalThis.navigator as INavigator)
      //     .storageBuckets;
      //   // const bucket = await storageBuckets?.open(bucketName, bucketOptions);
      //   const bucket = await storageBuckets?.open('hello-world', bucketOptions);
      //   if (!bucket?.indexedDB) {
      //     throw new Error(`Failed to open bucket indexedDB: ${bucketName}`);
      //   }
      //   idb = bucket.indexedDB;
      // }
      // // import { deleteDB, openDB } from 'idb';
      // const indexed = await openDB<IIndexedDBSchemaMap>(
      //   self.buildDbName(bucketName),
      //   INDEXED_DB_VERSION,
      //   {
      //     // TODO patch idb
      //     indexedDBInstance: idb,
      //     upgrade(db0, oldVersion, newVersion, transaction) {
      //       // add object stores here
      //       return self._handleDbUpgrade({
      //         bucketName,
      //         db: db0,
      //         oldVersion,
      //         newVersion,
      //         transaction,
      //       });
      //     },
      //   },
      // );

      const indexed = new IndexedDBPromised<IIndexedDBSchemaMap>({
        bucket: bucketName,
        name: self.buildDbName(bucketName),
        version: INDEXED_DB_VERSION,
        upgrade: (params) => {
          return self._handleDbUpgrade({
            bucketName,
            db: params.database,
            nativeDB: params.nativeDB,
            oldVersion: params.oldVersion,
            newVersion: params.newVersion,
            transaction: params.transaction,
          });
        },
      });
      await indexed._openDB();

      buckets[bucketName] = indexed;
      if (process.env.NODE_ENV !== 'production') {
        appGlobals.$$indexedDBBuckets = buckets;
      }
    }

    // add initial records to store

    const db = new IndexedDBAgent(buckets);
    try {
      await this._initDBRecords(db);
    } catch (error) {
      throw new Error(
        `Failed to init db records: ${(error as Error)?.message}`,
      );
    }
    return db;
  }

  private async _addSingletonWalletRecord({
    walletStore,
    walletId,
  }: {
    walletStore: IndexedDBObjectStorePromised<
      IIndexedDBSchemaMap,
      ELocalDBStoreNames.Wallet[],
      ELocalDBStoreNames.Wallet,
      'readwrite'
    >;
    walletId: IDBWalletIdSingleton;
  }) {
    await this._getOrAddRecord(
      walletStore,
      this.buildSingletonWalletRecord({
        walletId,
      }),
    );
  }

  private async _initDBRecords(db: IndexedDBAgent) {
    const { tx } = await db._buildTransactionAndStores({
      bucketName: EIndexedDBBucketNames.account,
      alwaysCreate: true,
    });
    if (!tx.stores) {
      throw new Error('tx.stores is undefined');
    }
    const { Context: contextStore, Wallet: walletStore } = tx.stores;
    await Promise.all([
      this._getOrAddRecord(contextStore, {
        id: DB_MAIN_CONTEXT_ID,
        nextHD: 1,
        nextWalletNo: 1,
        verifyString: DEFAULT_VERIFY_STRING,
        backupUUID: generateUUID(),
        nextSignatureMessageId: 1,
        nextSignatureTransactionId: 1,
        nextConnectedSiteId: 1,
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

  private _createObjectStoreAtVersionChange<
    T extends ELocalDBStoreNames,
  >(params: {
    db: IDBPDatabase<IIndexedDBSchemaMap>;
    nativeDB: IDBDatabase;
    tx: IDBPTransaction<
      IIndexedDBSchemaMap,
      ELocalDBStoreNames[],
      'versionchange'
    >;
    storeName: T;
  }): IDBObjectStore {
    const { db, tx, storeName, nativeDB } = params;
    return nativeDB.createObjectStore(storeName, { keyPath: 'id' });
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

  private _getOrCreateObjectStoreAtVersionChange<
    T extends ELocalDBStoreNames,
  >(params: {
    db: IDBPDatabase<IIndexedDBSchemaMap>;
    nativeDB: IDBDatabase;
    tx: IDBPTransaction<
      IIndexedDBSchemaMap,
      ELocalDBStoreNames[],
      'versionchange'
    >;
    storeName: T;
    bucketName: EIndexedDBBucketNames;
  }):
    | IDBPObjectStore<IIndexedDBSchemaMap, T[], T, 'versionchange'>
    | undefined {
    const { db, tx, storeName, bucketName, nativeDB } = params;
    try {
      const store = this._getObjectStoreAtVersionChange(tx, storeName);
      // const dd = await store.get('');
      return store;
    } catch (error) {
      errorUtils.autoPrintErrorIgnore(error);
      if (indexedUtils.getBucketNameByStoreName(storeName) === bucketName) {
        const createdStore = this._createObjectStoreAtVersionChange({
          db,
          nativeDB,
          tx,
          storeName,
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
      return undefined;
    }
  }

  private async _getOrAddRecord<T extends ELocalDBStoreNames>(
    store: IndexedDBObjectStorePromised<
      IIndexedDBSchemaMap,
      T[],
      T,
      'readwrite'
    >,
    record: IIndexedDBSchemaMap[T]['value'],
  ): Promise<IIndexedDBSchemaMap[T]['value'] | undefined> {
    /* get store like this
    const store = this._getOrCreateObjectStore(
      db,
      ELocalDBStoreNames.context,
    );
    */
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
    const names = Object.values(EIndexedDBBucketNames);
    await Promise.all(
      names.map(async (name) => {
        const indexedDb = db.getIndexedByBucketName(name);
        // TODO close async and try catch
        indexedDb.close();

        // TODO delete bucket indexedDB
        // // import { deleteDB, openDB } from 'idb';
        //
        // await deleteDB(INDEXED_DB_NAME);

        await IndexedDBPromised.deleteDatabase({
          bucketName: name,
          name: this.buildDbName(name),
        });
      }),
    );
  }
}
