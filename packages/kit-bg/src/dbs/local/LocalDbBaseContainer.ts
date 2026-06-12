import { cloneDeep, isString } from 'lodash';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import cacheUtils, { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import cloudSyncUtils from '@onekeyhq/shared/src/utils/cloudSyncUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import indexedUtils from './indexed/indexedDBUtils';
import { ELocalDBStoreNames } from './localDBStoreNames';
import { EIndexedDBBucketNames } from './types';

import type {
  IDBAccount,
  IDBDevice,
  IDBIndexedAccount,
  IDBWallet,
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
  ILocalDBRemoveRecordsParams,
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
} from './types';

export abstract class LocalDbBaseContainer implements ILocalDBAgent {
  abstract readyDb: Promise<ILocalDBAgent>;

  private normalizeCloudSyncRecordDataTime<TRecord>(record: TRecord): TRecord {
    if (!record || typeof record !== 'object') {
      return record;
    }
    const recordWithDataTime = record as TRecord & { dataTime?: number };
    recordWithDataTime.dataTime = cloudSyncUtils.normalizeDataTime(
      recordWithDataTime.dataTime,
    );
    return recordWithDataTime;
  }

  private normalizeCloudSyncRecordPairDataTime<TPair>(pair: TPair): TPair {
    if (!Array.isArray(pair)) {
      return pair;
    }
    const [record, schemaRecord] = pair as [unknown, unknown];
    return [
      this.normalizeCloudSyncRecordDataTime(record),
      schemaRecord,
    ] as TPair;
  }

  private normalizeCloudSyncGetResult<
    T extends ELocalDBStoreNames,
    TResult extends {
      records?: unknown[];
      recordPairs?: unknown[];
    },
  >({ name, result }: { name: T; result: TResult }): TResult {
    if (name !== ELocalDBStoreNames.CloudSyncItem) {
      return result;
    }
    return {
      ...result,
      records: result.records?.map((record) =>
        this.normalizeCloudSyncRecordDataTime(record),
      ),
      recordPairs: result.recordPairs?.map((pair) =>
        this.normalizeCloudSyncRecordPairDataTime(pair),
      ),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async withTransaction<T>(
    bucketName: EIndexedDBBucketNames,
    task: ILocalDBWithTransactionTask<T>,
    options?: ILocalDBWithTransactionOptions,
  ): Promise<T> {
    // throw new OneKeyLocalError(
    //   'Directly call withTransaction() is NOT allowed, please use (await this.readyDb).withTransaction() at DB layer',
    // );
    if (!isString(bucketName)) {
      // throw new Error('bucketName is required');
    }

    if (bucketName === EIndexedDBBucketNames.account) {
      await appGlobals.$backgroundApiProxy.serviceKeylessCloudSync.hydrateKeylessSyncCredentialFromStorageIfNeeded();
    }

    const db = await this.readyDb;
    // TODO default to readOnly: true
    return db.withTransaction(bucketName, task, options);
  }

  async getRecordsCount<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordsCountParams<T>,
  ): Promise<ILocalDBGetRecordsCountResult> {
    const db = await this.readyDb;
    return db.getRecordsCount(params);
  }

  async txGetRecordsCount<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordsCountParams<T>,
  ): Promise<ILocalDBGetRecordsCountResult> {
    const db = await this.readyDb;
    return db.txGetRecordsCount(params);
  }

  async getAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBGetAllRecordsParams<T>,
  ): Promise<ILocalDBGetAllRecordsResult<T>> {
    const db = await this.readyDb;
    const result = await db.getAllRecords(params);
    return this.normalizeCloudSyncGetResult({
      name: params.name,
      result,
    });
  }

  async getRecordsByIds<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordsByIdsParams<T>,
  ): Promise<ILocalDBGetRecordsByIdsResult<T>> {
    const db = await this.readyDb;
    const result = await db.getRecordsByIds(params);
    return this.normalizeCloudSyncGetResult({
      name: params.name,
      result,
    });
  }

  async getRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordByIdParams<T>,
  ): Promise<ILocalDBGetRecordByIdResult<T>> {
    // eslint-disable-next-line prefer-const
    let shouldUseCache = this.isCachedStoreName(params.name);
    if (
      params.name === ELocalDBStoreNames.Account &&
      params.id === accountUtils.URL_ACCOUNT_ID
    ) {
      // shouldUseCache = false;
    }
    if (shouldUseCache) {
      const cache = await this.getRecordByIdWithCache(params);
      return cloneDeep(cache);
    }

    const db = await this.readyDb;
    const record = await db.getRecordById(params);
    if (params.name === ELocalDBStoreNames.CloudSyncItem) {
      return this.normalizeCloudSyncRecordDataTime(record);
    }
    return record;
  }

  async getRecordIds<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordIdsParams<T>,
  ): Promise<ILocalDBGetRecordIdsResult> {
    const db = await this.readyDb;
    return db.getRecordIds(params);
  }

  private getRecordByIdWithCache = memoizee(
    async <T extends ELocalDBStoreNames>(
      params: ILocalDBGetRecordByIdParams<T>,
    ) => {
      const db = await this.readyDb;
      return db.getRecordById(params);
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 10 }),
    },
  );

  isCachedStoreName(storeName: ELocalDBStoreNames) {
    return [
      ELocalDBStoreNames.Account,
      ELocalDBStoreNames.IndexedAccount,
      ELocalDBStoreNames.Wallet,
      ELocalDBStoreNames.Device,
    ].includes(storeName);
  }

  dbAllRecordsCache = new cacheUtils.LRUCache<
    'allDbAccounts' | 'allDbIndexedAccounts' | 'allDbWallets' | 'allDbDevices',
    IDBAccount[] | IDBIndexedAccount[] | IDBWallet[] | IDBDevice[]
  >({
    max: 10,
    ttl: timerUtils.getTimeDurationMs({ seconds: 5 }),
  });

  // Negative cache for getAccountNameFromAddress's scan fallback: remembers
  // `${networkId}--${address}` combos that a full-account scan found no owner
  // for, so repeatedly searching the same not-held address (the common
  // universal-search case) does not re-run an O(n) scan plus a getAllAccounts()
  // deep-clone every time. Flushed by clearStoreCachedData() on any
  // account/wallet write, so a newly created account is still found immediately.
  scanAccountMissCache = new cacheUtils.LRUCache<string, true>({
    max: 100,
    ttl: timerUtils.getTimeDurationMs({ seconds: 30 }),
  });

  getAllRecordsByCache<T>(
    cacheKey:
      | 'allDbAccounts'
      | 'allDbIndexedAccounts'
      | 'allDbWallets'
      | 'allDbDevices',
  ) {
    const allItemsInCache = this.dbAllRecordsCache.get(cacheKey) as T[];
    if (allItemsInCache && allItemsInCache.length) {
      return cloneDeep(allItemsInCache);
    }
    return undefined;
  }

  clearStoreCachedDataIfMatch(storeName: ELocalDBStoreNames) {
    if (this.isCachedStoreName(storeName)) {
      this.clearStoreCachedData();
    }
  }

  clearStoreCachedData() {
    this.getRecordByIdWithCache.clear();
    this.dbAllRecordsCache.clear();
    this.scanAccountMissCache.clear();
  }

  async removeRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBRemoveRecordsParams<T>,
  ) {
    const bucketName = indexedUtils.getBucketNameByStoreName(params.name);
    return this.withTransaction(bucketName, (tx) => {
      return this.txRemoveRecords({
        ...params,
        tx,
      });
    });
  }

  async txGetAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetAllRecordsParams<T>,
  ): Promise<ILocalDBTxGetAllRecordsResult<T>> {
    const db = await this.readyDb;
    const result = await db.txGetAllRecords(params);
    return this.normalizeCloudSyncGetResult({
      name: params.name,
      result,
    });
  }

  async txGetRecordsByIds<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordsByIdsParams<T>,
  ): Promise<ILocalDBTxGetRecordsByIdsResult<T>> {
    const db = await this.readyDb;
    const result = await db.txGetRecordsByIds(params);
    return this.normalizeCloudSyncGetResult({
      name: params.name,
      result,
    });
  }

  async txGetRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordByIdParams<T>,
  ): Promise<ILocalDBTxGetRecordByIdResult<T>> {
    const db = await this.readyDb;
    const pair = await db.txGetRecordById(params);
    if (params.name === ELocalDBStoreNames.CloudSyncItem) {
      return this.normalizeCloudSyncRecordPairDataTime(pair);
    }
    return pair;
  }

  async txGetRecordIds<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordIdsParams<T>,
  ): Promise<ILocalDBTxGetRecordIdsResult> {
    const db = await this.readyDb;
    return db.txGetRecordIds(params);
  }

  async txUpdateRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxUpdateRecordsParams<T>,
  ): Promise<void> {
    this.clearStoreCachedDataIfMatch(params.name);
    const db = await this.readyDb;
    // const a = db.txAddRecords['hello-world-test-error-stack-8889273']['name'];
    if (params.name === ELocalDBStoreNames.CloudSyncItem) {
      const { updater } = params;
      return db.txUpdateRecords({
        ...params,
        updater: async (record) => {
          const updatedRecord = await updater(record);
          return this.normalizeCloudSyncRecordDataTime(updatedRecord);
        },
      });
    }
    return db.txUpdateRecords(params);
  }

  async txAddRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxAddRecordsParams<T>,
  ): Promise<ILocalDBTxAddRecordsResult> {
    this.clearStoreCachedDataIfMatch(params.name);
    const db = await this.readyDb;
    if (params.name === ELocalDBStoreNames.CloudSyncItem) {
      return db.txAddRecords({
        ...params,
        records: params.records.map((record) =>
          this.normalizeCloudSyncRecordDataTime({ ...record }),
        ),
      });
    }
    return db.txAddRecords(params);
  }

  async txRemoveRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxRemoveRecordsParams<T>,
  ): Promise<void> {
    this.clearStoreCachedDataIfMatch(params.name);
    const db = await this.readyDb;
    return db.txRemoveRecords(params);
  }

  abstract reset(): Promise<void>;

  async clearRecords(params: { name: ELocalDBStoreNames }) {
    this.clearStoreCachedDataIfMatch(params.name);
    const db = await this.readyDb;
    return db.clearRecords(params);
  }
}
