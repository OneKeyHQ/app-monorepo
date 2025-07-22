import { isNil, isNumber } from 'lodash';

import {
  LocalDBRecordNotFoundError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  IndexedDBObjectStorePromised,
  IndexedDBPromised,
  IndexedDBTransactionPromised,
} from '@onekeyhq/shared/src/IndexedDBPromised';
import dbPerfMonitor from '@onekeyhq/shared/src/utils/debug/dbPerfMonitor';
import { noopObject } from '@onekeyhq/shared/src/utils/miscUtils';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';

import { ALL_LOCAL_DB_STORE_NAMES } from '../consts';
import { LocalDbAgentBase } from '../LocalDbAgentBase';
import { ELocalDBStoreNames } from '../localDBStoreNames';
import { EIndexedDBBucketNames } from '../types';

import indexedUtils from './indexedDBUtils';

import type {
  IIndexedBucketsMap,
  IIndexedDBSchemaMap,
  ILocalDBAgent,
  ILocalDBGetAllRecordsParams,
  ILocalDBGetAllRecordsResult,
  ILocalDBGetRecordByIdParams,
  ILocalDBGetRecordByIdResult,
  ILocalDBGetRecordIdsParams,
  ILocalDBGetRecordIdsResult,
  ILocalDBGetRecordsByIdsParams,
  ILocalDBGetRecordsByIdsResult,
  ILocalDBGetRecordsCountParams,
  ILocalDBGetRecordsCountResult,
  ILocalDBRecord,
  ILocalDBRecordPair,
  ILocalDBRecordUpdater,
  ILocalDBTransaction,
  ILocalDBTransactionStores,
  ILocalDBTxAddRecordsParams,
  ILocalDBTxAddRecordsResult,
  ILocalDBTxGetAllRecordsParams,
  ILocalDBTxGetAllRecordsResult,
  ILocalDBTxGetRecordByIdParams,
  ILocalDBTxGetRecordByIdResult,
  ILocalDBTxGetRecordIdsParams,
  ILocalDBTxGetRecordIdsResult,
  ILocalDBTxGetRecordsByIdsParams,
  ILocalDBTxGetRecordsByIdsResult,
  ILocalDBTxGetRecordsCountParams,
  ILocalDBTxRemoveRecordsParams,
  ILocalDBTxUpdateRecordsParams,
  ILocalDBWithTransactionOptions,
  ILocalDBWithTransactionTask,
} from '../types';

export class IndexedDBAgent extends LocalDbAgentBase implements ILocalDBAgent {
  constructor(buckets: IIndexedBucketsMap) {
    super();
    this.buckets = buckets;
  }

  clearRecords({ name }: { name: ELocalDBStoreNames }): Promise<void> {
    const bucketName = indexedUtils.getBucketNameByStoreName(name);
    return this.withTransaction(bucketName, async (tx) => {
      const store = this._getObjectStoreFromTx(tx, name);
      await store.clear();
    });
  }

  getIndexedByBucketName(
    bucketName: EIndexedDBBucketNames,
  ): IndexedDBPromised<IIndexedDBSchemaMap> {
    if (!this.buckets) {
      throw new OneKeyLocalError('buckets not initialized');
    }
    const indexed = this.buckets[bucketName];
    if (!indexed) {
      throw new OneKeyLocalError(`indexedDB bucket not found: ${bucketName}`);
    }
    return indexed;
  }

  buckets: IIndexedBucketsMap | undefined;

  txPair:
    | {
        dbTx: IndexedDBTransactionPromised<
          IIndexedDBSchemaMap,
          ELocalDBStoreNames[],
          'readwrite'
        >;
        tx: ILocalDBTransaction;
      }
    | undefined;

  _getObjectStore<T extends ELocalDBStoreNames>(
    tx: IndexedDBTransactionPromised<IIndexedDBSchemaMap, T[], 'readwrite'>,
    storeName: T,
    _: IDBTransactionMode,
  ): IndexedDBObjectStorePromised<IIndexedDBSchemaMap, T[], T, 'readwrite'> {
    const store = tx.objectStore(storeName);
    return store;
  }

  _getOrCreateObjectStore<T extends ELocalDBStoreNames>(
    tx: IndexedDBTransactionPromised<IIndexedDBSchemaMap, T[], 'readwrite'>,
    storeName: T,
    mode: IDBTransactionMode,
    indexed: IndexedDBPromised<IIndexedDBSchemaMap>,
  ): IndexedDBObjectStorePromised<IIndexedDBSchemaMap, T[], T, 'readwrite'> {
    try {
      const store = this._getObjectStore(tx, storeName, mode);
      // const dd = await store.get('');
      return store;
    } catch {
      indexed.createObjectStore(storeName, {
        keyPath: 'id',
      });
      const store = this._getObjectStore(tx, storeName, mode);
      return store;
    }
  }

  async _buildTransactionAndStores({
    bucketName,
    alwaysCreate = true,
    readOnly = false,
  }: {
    bucketName: EIndexedDBBucketNames;
    alwaysCreate: boolean;
    readOnly?: boolean;
  }) {
    // eslint-disable-next-line spellcheck/spell-checker
    // type IDBTransactionMode = "readonly" | "readwrite" | "versionchange";
    const mode: 'readwrite' = readOnly ? ('readonly' as any) : 'readwrite';

    if (!this.txPair || alwaysCreate) {
      const indexed = this.getIndexedByBucketName(bucketName);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const allStoreNames = ALL_LOCAL_DB_STORE_NAMES;

      // const dbTx = indexed.transaction( // not working for bucket
      const dbTx = await indexed.createBucketTransaction(
        // allStoreNames,
        indexedUtils.getStoreNamesByBucketName(bucketName), // ALL_LOCAL_DB_STORE_NAMES
        // 'readwrite',
        mode,
      );
      let contextStore: any;
      let walletStore: any;
      let accountStore: any;
      let accountDerivationStore: any;
      let indexedAccountStore: any;
      let credentialStore: any;
      let deviceStore: any;
      let addressStore: any;
      let cloudSyncItemStore: any;
      let signMessageStore: any;
      let signedTransactionStore: any;
      let connectedSiteStore: any;
      let hardwareHomeScreenStore: any;

      switch (bucketName) {
        // case EIndexedDBBucketNames.cloudSync: {
        //   cloudSyncItemStore = this._getOrCreateObjectStore(
        //     dbTx,
        //     ELocalDBStoreNames.CloudSyncItem,
        //     mode,
        //     indexed,
        //   );
        //   break;
        // }

        case EIndexedDBBucketNames.account:
        case EIndexedDBBucketNames.backupAccount: {
          cloudSyncItemStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.CloudSyncItem,
            mode,
            indexed,
          );

          contextStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.Context,
            mode,
            indexed,
          );

          walletStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.Wallet,
            mode,
            indexed,
          );

          accountStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.Account,
            mode,
            indexed,
          );

          accountDerivationStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.AccountDerivation,
            mode,
            indexed,
          );

          indexedAccountStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.IndexedAccount,
            mode,
            indexed,
          );

          credentialStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.Credential,
            mode,
            indexed,
          );

          deviceStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.Device,
            mode,
            indexed,
          );

          break;
        }

        case EIndexedDBBucketNames.address: {
          addressStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.Address,
            mode,
            indexed,
          );
          break;
        }

        case EIndexedDBBucketNames.archive: {
          signMessageStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.SignedMessage,
            mode,
            indexed,
          );

          signedTransactionStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.SignedTransaction,
            mode,
            indexed,
          );

          connectedSiteStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.ConnectedSite,
            mode,
            indexed,
          );

          hardwareHomeScreenStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.HardwareHomeScreen,
            mode,
            indexed,
          );
          break;
        }

        default: {
          const exhaustiveCheck: never = bucketName;
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          throw new OneKeyLocalError(
            `Unsupported indexedDB bucket name: ${exhaustiveCheck as string}`,
          );
        }
      }

      const tx: ILocalDBTransaction = {
        bucketName,
        stores: {
          [ELocalDBStoreNames.Context]: contextStore,
          [ELocalDBStoreNames.Wallet]: walletStore,
          [ELocalDBStoreNames.IndexedAccount]: indexedAccountStore,
          [ELocalDBStoreNames.Account]: accountStore,
          [ELocalDBStoreNames.AccountDerivation]: accountDerivationStore,
          [ELocalDBStoreNames.Credential]: credentialStore,
          [ELocalDBStoreNames.Device]: deviceStore,
          [ELocalDBStoreNames.Address]: addressStore,
          [ELocalDBStoreNames.SignedMessage]: signMessageStore,
          [ELocalDBStoreNames.SignedTransaction]: signedTransactionStore,
          [ELocalDBStoreNames.ConnectedSite]: connectedSiteStore,
          [ELocalDBStoreNames.CloudSyncItem]: cloudSyncItemStore,
          [ELocalDBStoreNames.HardwareHomeScreen]: hardwareHomeScreenStore,
        },
      };

      this.txPair = {
        dbTx,
        tx,
      };
    }
    return this.txPair;
  }

  _getObjectStoreFromTx<T extends ELocalDBStoreNames>(
    tx: ILocalDBTransaction,
    storeName: T,
  ): ILocalDBTransactionStores[T] {
    const store = tx.stores?.[storeName];
    if (!store) {
      const message = `indexedDB store not found: ${storeName}, check IndexedDBAgent code. bucketName=${tx.bucketName}`;
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        title: 'Error',
        message,
        method: 'error',
      });
      throw new OneKeyLocalError(message);
    }
    return store;
  }

  async _executeUpdateRecord<T extends ELocalDBStoreNames>({
    name,
    updater,
    oldRecord,
    tx,
  }: {
    name: T;
    oldRecord: ILocalDBRecord<T>;
    updater: ILocalDBRecordUpdater<T>;
    tx: ILocalDBTransaction;
  }) {
    if (oldRecord) {
      const store = this._getObjectStoreFromTx(tx, name);
      const newRecord = await updater(oldRecord);
      await store.put(newRecord as any);
    }
  }

  // ----------------------------------------------

  async withTransaction<T>(
    bucketName: EIndexedDBBucketNames,
    task: ILocalDBWithTransactionTask<T>,
    options?: ILocalDBWithTransactionOptions,
  ): Promise<T> {
    noopObject(options);
    const { tx, dbTx } = await this._buildTransactionAndStores({
      bucketName,
      alwaysCreate: true,
      readOnly: options?.readOnly,
    });

    try {
      const result = await task(tx);
      // await dbTx.done;
      return result;
    } catch (error) {
      let abortError: unknown | undefined;
      try {
        // cause: Uncaught (in promise) AbortError: AbortError
        dbTx.abort();
        // Cannot set property error of #<IDBTransaction> which has only a getter
        // dbTx.nativeTx.error = dbTx.nativeTx.error || error;
      } catch (error2) {
        abortError = error2;
      } finally {
        if (process.env.NODE_ENV !== 'production') {
          const isRecordNotFoundError =
            error instanceof LocalDBRecordNotFoundError ||
            errorUtils.isErrorByClassName({
              error,
              className: EOneKeyErrorClassNames.LocalDBRecordNotFoundError,
            });

          if (!isRecordNotFoundError) {
            console.error(error);
            if (abortError) {
              console.error(abortError);
            }
            errorUtils.logCurrentCallStack('localDB.withTransaction Failed');
          }
        }
      }
      throw error;
    }
  }

  override async getRecordsCount<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordsCountParams<T>,
  ): Promise<ILocalDBGetRecordsCountResult> {
    const bucketName = indexedUtils.getBucketNameByStoreName(params.name);
    return this.withTransaction(
      bucketName,
      async (tx) =>
        this.txGetRecordsCount({
          ...params,
          tx,
        }),
      {
        readOnly: true,
      },
    );
  }

  async getRecordsByIds<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordsByIdsParams<T>,
  ): Promise<ILocalDBGetRecordsByIdsResult<T>> {
    const bucketName = indexedUtils.getBucketNameByStoreName(params.name);
    return this.withTransaction(
      bucketName,
      async (tx) => {
        const { records } = await this.txGetRecordsByIds({
          ...params,
          tx,
        });
        return { records };
      },
      {
        readOnly: true,
      },
    );
  }

  async getAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBGetAllRecordsParams<T>,
  ): Promise<ILocalDBGetAllRecordsResult<T>> {
    const bucketName = indexedUtils.getBucketNameByStoreName(params.name);
    return this.withTransaction(
      bucketName,
      async (tx) => {
        const { records } = await this.txGetAllRecords({
          ...params,
          tx,
        });
        return { records };
      },
      {
        readOnly: true,
      },
    );
  }

  async getRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordByIdParams<T>,
  ): Promise<ILocalDBGetRecordByIdResult<T>> {
    // logLocalDbCall(`getRecordById`, params.name, [params.id]);
    const bucketName = indexedUtils.getBucketNameByStoreName(params.name);
    return this.withTransaction(
      bucketName,
      async (tx) => {
        const [record] = await this.txGetRecordById({
          ...params,
          tx,
        });
        return record;
      },
      {
        readOnly: true,
      },
    );
  }

  async getRecordIds<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordIdsParams<T>,
  ): Promise<ILocalDBGetRecordIdsResult> {
    const bucketName = indexedUtils.getBucketNameByStoreName(params.name);
    return this.withTransaction(
      bucketName,
      async (tx) => {
        const ids = await this.txGetRecordIds({ ...params, tx });
        return ids;
      },
      {
        readOnly: true,
      },
    );
  }

  override async txGetRecordsCount<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordsCountParams<T>,
  ): Promise<ILocalDBGetRecordsCountResult> {
    const { tx: paramsTx, name } = params;
    dbPerfMonitor.logLocalDbCall(`txGetRecordsCount`, name, [true]);
    const fn = async (tx: ILocalDBTransaction) => {
      const store = this._getObjectStoreFromTx(tx, name);
      const count = await store.count();
      return {
        count,
      };
    };
    return fn(paramsTx);
  }

  async txGetRecordsByIds<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordsByIdsParams<T>,
  ): Promise<ILocalDBTxGetRecordsByIdsResult<T>> {
    const { tx: paramsTx, name, ids } = params;
    dbPerfMonitor.logLocalDbCall(`txGetRecordsByIds`, name, [
      `ids_count=${ids ? ids?.length?.toString() : ''}`,
    ]);
    const fn = async (tx: ILocalDBTransaction) => {
      const store = this._getObjectStoreFromTx<T>(tx, name);
      // TODO add query support
      // query?: StoreKey<DBTypes, StoreName> | IDBKeyRange | null, count?: number
      let results: unknown[] = [];

      results = await Promise.all(ids.map((id) => store.get(id)));

      const recordPairs: ILocalDBRecordPair<T>[] = [];
      const records: ILocalDBRecord<T>[] = [];

      results.forEach((record) => {
        records.push(record as any);
        recordPairs.push([record as any, null]);
      });
      return {
        recordPairs,
        records,
      };
    };

    return fn(paramsTx);
  }

  async txGetAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetAllRecordsParams<T>,
  ): Promise<ILocalDBTxGetAllRecordsResult<T>> {
    const { tx: paramsTx, name, limit, offset } = params;
    dbPerfMonitor.logLocalDbCall(`txGetAllRecords`, name, [`ids_count=ALL`]);
    const fn = async (tx: ILocalDBTransaction) => {
      const store = this._getObjectStoreFromTx<T>(tx, name);
      // TODO add query support
      // query?: StoreKey<DBTypes, StoreName> | IDBKeyRange | null, count?: number
      let results: unknown[] = [];

      if (isNumber(limit) && isNumber(offset)) {
        const indexStore =
          store as ILocalDBTransactionStores[ELocalDBStoreNames.SignedMessage];
        if (indexStore.indexNames.contains('createdAt')) {
          const cursor = await indexStore
            .index('createdAt')
            .openCursor(null, 'prev');

          let skipped = 0;
          while (cursor) {
            if (skipped < offset) {
              skipped += 1;
            } else if (results.length <= limit) {
              results.push(cursor.value);
            }
            const data = await cursor.continue();
            if (!data || results.length >= limit) {
              break;
            }
          }
        } else {
          results = await store.getAll();
        }
      } else {
        results = await store.getAll();
      }

      const recordPairs: ILocalDBRecordPair<T>[] = [];
      const records: ILocalDBRecord<T>[] = [];

      results.forEach((record) => {
        records.push(record as any);
        recordPairs.push([record as any, null]);
      });
      return {
        recordPairs,
        records,
      };
    };

    return fn(paramsTx);
  }

  async txGetRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordByIdParams<T>,
  ): Promise<ILocalDBTxGetRecordByIdResult<T>> {
    const { tx: paramsTx, name, id } = params;
    const fn: (
      tx: ILocalDBTransaction,
    ) => Promise<ILocalDBTxGetRecordByIdResult<T>> = async (
      tx: ILocalDBTransaction,
    ) => {
      const store = this._getObjectStoreFromTx(tx, name);
      dbPerfMonitor.logLocalDbCall(`txGetRecordById`, name, [id]);
      const record = await store.get(id);
      if (!record) {
        const error = new LocalDBRecordNotFoundError(
          `record not found: ${name} ${id}`,
        );
        errorUtils.autoPrintErrorIgnore(error);
        throw error;
      }
      return [record as any, null];
    };
    return fn(paramsTx);
  }

  async txUpdateRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxUpdateRecordsParams<T>,
  ): Promise<void> {
    resetUtils.checkNotInResetting();

    const { name, tx, updater } = params;
    const pairs = await this.buildRecordPairsFromIds(params);
    dbPerfMonitor.logLocalDbCall(`txUpdateRecords`, name, [
      `records: ${pairs.length}`,
    ]);
    await Promise.all(
      pairs.map((pair) =>
        this._executeUpdateRecord({
          name,
          tx,
          updater,
          // TODO only update first record?
          oldRecord: pair[0],
        }),
      ),
    );
  }

  async txAddRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxAddRecordsParams<T>,
  ): Promise<ILocalDBTxAddRecordsResult> {
    resetUtils.checkNotInResetting();

    const { name, tx, records, skipIfExists } = params;
    const store = this._getObjectStoreFromTx(tx, name);
    const result: ILocalDBTxAddRecordsResult = {
      added: 0,
      skipped: 0,
      addedIds: [],
    };
    dbPerfMonitor.logLocalDbCall(`txAddRecords`, name, [
      `records: ${records.length}`,
    ]);
    for (const record of records) {
      let shouldAdd = true;
      if (skipIfExists) {
        const existingRecord = await store.get(record.id);
        if (existingRecord) {
          shouldAdd = false;
        }
      }
      if (shouldAdd) {
        await store.add(record as any);
        result.added += 1;
        result.addedIds.push(record.id);
      } else {
        result.skipped += 1;
      }
    }
    return result;
  }

  async txGetRecordIds<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordIdsParams<T>,
  ): Promise<ILocalDBTxGetRecordIdsResult> {
    const { tx: paramsTx, name } = params;
    const fn = async (tx: ILocalDBTransaction) => {
      const store = this._getObjectStoreFromTx(tx, name);
      const ids = await store.getAllKeys();
      return ids;
    };
    return fn(paramsTx);
  }

  async txRemoveRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxRemoveRecordsParams<T>,
  ): Promise<void> {
    resetUtils.checkNotInResetting();
    const { name, tx } = params;
    const store = this._getObjectStoreFromTx(tx, name);
    const pairs = await this.buildRecordPairsFromIds(params);
    dbPerfMonitor.logLocalDbCall(`txRemoveRecords`, name, [
      `records: ${pairs.length}`,
    ]);
    await Promise.all(
      pairs.map(async (pair) => {
        // TODO only remove first record?
        const recordId = pair[0]?.id;
        if (isNil(recordId)) {
          throw new OneKeyLocalError(
            'dbRemoveRecord ERROR: recordId not found',
          );
        }
        return store.delete(recordId);
      }),
    );
  }
}
