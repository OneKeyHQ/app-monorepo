import { isNil } from 'lodash';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import {
  DB_MAIN_CONTEXT_ID,
  DEFAULT_VERIFY_STRING,
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import type {
  IndexedDBObjectStorePromised,
  IndexedDBTransactionPromised,
} from '@onekeyhq/shared/src/IndexedDBPromised';
import { IndexedDBPromised } from '@onekeyhq/shared/src/IndexedDBPromised';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import indexedToBucketsMigration from '../../../migrations/indexedToBucketsMigration/indexedToBucketsMigration';
import { INDEXED_DB_VERSION, storeNameSupportCreatedAt } from '../consts';
import { LocalDbBase } from '../LocalDbBase';
import { ELocalDBStoreNames } from '../localDBStoreNames';
import {
  EIndexedDBBucketNames,
  INDEXED_BUCKET_NAME_BACKUP_PREFIX,
} from '../types';

import { IndexedDBAgent } from './IndexedDBAgent';
import indexedDBUtils from './indexedDBUtils';

import type { ICheckCurrentDBIsMigratedToBucketResult } from '../../../migrations/indexedToBucketsMigration/indexedToBucketsMigration';
import type {
  IDBWalletIdSingleton,
  IIndexedBucketsMap,
  IIndexedDBSchemaMap,
} from '../types';

export abstract class LocalDbIndexedBase extends LocalDbBase {
  constructor() {
    super();
    this.readyDb = this._openDb();
  }

  override readyDb: Promise<IndexedDBAgent>;

  // ---------------------------------------------- private methods

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _handleDbUpgrade(options: {
    bucketName: EIndexedDBBucketNames;
    db: IndexedDBPromised<IIndexedDBSchemaMap>;
    nativeDB: IDBDatabase;
    oldVersion: number;
    newVersion: number | null;
    transaction: IndexedDBTransactionPromised<
      IIndexedDBSchemaMap,
      ArrayLike<ELocalDBStoreNames>,
      'versionchange'
    >;
  }): null {
    const { db, transaction, bucketName, nativeDB } = options;

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

  private async _openDb(): Promise<IndexedDBAgent> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    const buckets: IIndexedBucketsMap = {
      [EIndexedDBBucketNames.account]: undefined as any,
      [EIndexedDBBucketNames.backupAccount]: undefined as any,
      [EIndexedDBBucketNames.address]: undefined as any,
      [EIndexedDBBucketNames.archive]: undefined as any,
      // [EIndexedDBBucketNames.cloudSync]: undefined as any,
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
      //     throw new OneKeyLocalError(`Failed to open bucket indexedDB: ${bucketName}`);
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
        bucketName,
        name: indexedDBUtils.buildDbName(bucketName),
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
      await indexed.open();

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
      throw new OneKeyLocalError(
        `Failed to init db records: ${(error as Error)?.message}`,
      );
    }

    try {
      const checkMigratedResult: ICheckCurrentDBIsMigratedToBucketResult =
        await indexedToBucketsMigration.checkCurrentDBIsMigrated({
          buckets,
        });
      if (checkMigratedResult) {
        try {
          await indexedToBucketsMigration.migrateOneKeyV5LegacyDBToBucket(
            checkMigratedResult,
          );
        } catch (error) {
          console.error(
            'migrateOneKeyV5LegacyDBToBucket ERROR: ',
            error,
            checkMigratedResult,
          );
        }
        try {
          await indexedToBucketsMigration.migrateBackupedDataToBucket(
            checkMigratedResult,
          );
        } catch (error) {
          console.error(
            'migrateBackupedDataToBucket ERROR: ',
            error,
            checkMigratedResult,
          );
        }

        globalThis.$indexedDBIsMigratedToBucket = checkMigratedResult;
      }
    } catch (error) {
      console.error('checkCurrentDBIsMigrated ERROR: ', error);
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
      throw new OneKeyLocalError('tx.stores is undefined');
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
    db: IndexedDBPromised<IIndexedDBSchemaMap>;
    nativeDB: IDBDatabase;
    tx: IndexedDBTransactionPromised<
      IIndexedDBSchemaMap,
      ArrayLike<ELocalDBStoreNames>,
      'versionchange'
    >;
    storeName: T;
  }): IDBObjectStore {
    const { storeName, nativeDB } = params;
    return nativeDB.createObjectStore(storeName, { keyPath: 'id' });
  }

  private _getObjectStoreAtVersionChange<T extends ELocalDBStoreNames>(
    tx: IndexedDBTransactionPromised<
      IIndexedDBSchemaMap,
      ArrayLike<ELocalDBStoreNames>,
      'versionchange'
    >,
    storeName: T,
  ): IndexedDBObjectStorePromised<
    IIndexedDBSchemaMap,
    T[],
    T,
    'versionchange'
  > {
    const store = tx.objectStore(storeName);
    // @ts-ignore
    return store;
  }

  private _getOrCreateObjectStoreAtVersionChange<
    T extends ELocalDBStoreNames,
  >(params: {
    db: IndexedDBPromised<IIndexedDBSchemaMap>;
    nativeDB: IDBDatabase;
    tx: IndexedDBTransactionPromised<
      IIndexedDBSchemaMap,
      ArrayLike<ELocalDBStoreNames>,
      'versionchange'
    >;
    storeName: T;
    bucketName: EIndexedDBBucketNames;
  }):
    | IndexedDBObjectStorePromised<IIndexedDBSchemaMap, T[], T, 'versionchange'>
    | undefined {
    const { db, tx, storeName, bucketName, nativeDB } = params;
    const bucketNameFromStoreName =
      indexedDBUtils.getBucketNameByStoreName(storeName);

    if (
      bucketName === bucketNameFromStoreName ||
      bucketName === INDEXED_BUCKET_NAME_BACKUP_PREFIX + bucketNameFromStoreName
    ) {
      try {
        const store = this._getObjectStoreAtVersionChange(tx, storeName);
        // const dd = await store.get('');
        return store;
      } catch (error) {
        errorUtils.autoPrintErrorIgnore(error);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    }

    return undefined;
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
    const bucketNames = Object.values(EIndexedDBBucketNames);
    await Promise.all(
      bucketNames.map(async (bucketName) => {
        try {
          const indexedDb = db.getIndexedByBucketName(bucketName);
          indexedDb.close();

          await timerUtils.wait(100);

          // // import { deleteDB, openDB } from 'idb';
          //
          // await deleteDB(INDEXED_DB_NAME);
          await IndexedDBPromised.deleteDatabase({
            bucketName,
            name: indexedDBUtils.buildDbName(bucketName),
          });

          await timerUtils.wait(100);

          const storageBuckets = (globalThis.navigator as INavigator)
            .storageBuckets;
          await storageBuckets?.delete(bucketName);

          await timerUtils.wait(100);
        } catch (error) {
          console.error(error);
        }
      }),
    );
  }
}
