import { cloneDeep, isString } from 'lodash';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import cacheUtils, { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import cloudSyncUtils from '@onekeyhq/shared/src/utils/cloudSyncUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import indexedUtils from './indexed/indexedDBUtils';
import { ELocalDBStoreNames } from './localDBStoreNames';
import { maskedLocalDbAgent } from './MaskedLocalDbAgent';
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

  private transactionAgents = new WeakMap<object, ILocalDBAgent>();

  protected getReadyDbForAdmittedOperation(): Promise<ILocalDBAgent> {
    return this.readyDb;
  }

  private async runWithProtectedAgent<T>(
    task: (db: ILocalDBAgent) => Promise<T>,
    tx?: object,
  ): Promise<T> {
    const transactionAgent = tx ? this.transactionAgents.get(tx) : undefined;
    if (transactionAgent) {
      return task(transactionAgent);
    }

    const environment = await travelModeManager.getRuntimeEnvironment();
    return environment.persistence.run({
      operation: async () => task(await this.getReadyDbForAdmittedOperation()),
      onBlocked: () => task(maskedLocalDbAgent),
    });
  }

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

    const runTransaction = async (db: ILocalDBAgent) => {
      if (
        db !== maskedLocalDbAgent &&
        bucketName === EIndexedDBBucketNames.account
      ) {
        // best-effort cache warm-up, must never block or fail the transaction.
        // Cap the wait so a hung hydration can't stall account-bucket writes,
        // and clear the timer when hydration wins so we don't leak a pending
        // timeout per transaction.
        let warmupTimer: ReturnType<typeof setTimeout> | undefined;
        try {
          const hydrationPromise =
            appGlobals.$backgroundApiProxy.serviceKeylessCloudSync.hydrateKeylessSyncCredentialFromStorageIfNeeded();
          // If the timeout wins the race, hydration keeps running with no awaiter;
          // guard it so a later rejection can't surface as an unhandled rejection.
          void hydrationPromise.catch(() => undefined);
          const warmupTimeout = new Promise<void>((resolve) => {
            warmupTimer = setTimeout(resolve, 5000);
          });
          await Promise.race([hydrationPromise, warmupTimeout]);
        } catch (error) {
          console.error(
            'hydrateKeylessSyncCredentialFromStorageIfNeeded error',
            error,
          );
        } finally {
          if (warmupTimer) {
            clearTimeout(warmupTimer);
          }
        }
      }

      // TODO default to readOnly: true
      return await db.withTransaction(
        bucketName,
        async (tx) => {
          this.transactionAgents.set(tx, db);
          try {
            return await task(tx);
          } finally {
            this.transactionAgents.delete(tx);
          }
        },
        options,
      );
    };
    const environment = await travelModeManager.getRuntimeEnvironment();
    return environment.persistence.run({
      operation: async () =>
        runTransaction(await this.getReadyDbForAdmittedOperation()),
      onBlocked: () => runTransaction(maskedLocalDbAgent),
    });
  }

  /**
   * For transactions whose net effect is freeing space — removing wallets,
   * accounts, credentials, archived history.
   *
   * These must stay available while the disk-full guard is raised: deleting
   * local data is the main way a user recovers, so blocking them turns a
   * recoverable state into a dead end. Some of these transactions also update
   * a record along the way (e.g. `removeWallet` rewriting a wallet it converts
   * to mocked); that is a rounding error next to what the same transaction
   * deletes, and refusing to start guarantees the failure that allowing it
   * merely risks.
   */
  async withSpaceFreeingTransaction<T>(
    bucketName: EIndexedDBBucketNames,
    task: ILocalDBWithTransactionTask<T>,
  ): Promise<T> {
    return this.withTransaction(bucketName, task, {
      allowWhenStorageFull: true,
    });
  }

  async getRecordsCount<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordsCountParams<T>,
  ): Promise<ILocalDBGetRecordsCountResult> {
    return this.runWithProtectedAgent((db) => db.getRecordsCount(params));
  }

  async txGetRecordsCount<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordsCountParams<T>,
  ): Promise<ILocalDBGetRecordsCountResult> {
    return this.runWithProtectedAgent(
      (db) => db.txGetRecordsCount(params),
      params.tx,
    );
  }

  async getAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBGetAllRecordsParams<T>,
  ): Promise<ILocalDBGetAllRecordsResult<T>> {
    const result = await this.runWithProtectedAgent((db) =>
      db.getAllRecords(params),
    );
    return this.normalizeCloudSyncGetResult({
      name: params.name,
      result,
    });
  }

  async getRecordsByIds<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordsByIdsParams<T>,
  ): Promise<ILocalDBGetRecordsByIdsResult<T>> {
    const result = await this.runWithProtectedAgent((db) =>
      db.getRecordsByIds(params),
    );
    return this.normalizeCloudSyncGetResult({
      name: params.name,
      result,
    });
  }

  async getRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordByIdParams<T>,
  ): Promise<ILocalDBGetRecordByIdResult<T>> {
    const environment = await travelModeManager.getRuntimeEnvironment();
    return environment.persistence.run({
      operation: async () => {
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

        const db = await this.getReadyDbForAdmittedOperation();
        const record = await db.getRecordById(params);
        if (params.name === ELocalDBStoreNames.CloudSyncItem) {
          return this.normalizeCloudSyncRecordDataTime(record);
        }
        return record;
      },
      onBlocked: () => maskedLocalDbAgent.getRecordById(params),
    });
  }

  async getRecordIds<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordIdsParams<T>,
  ): Promise<ILocalDBGetRecordIdsResult> {
    return this.runWithProtectedAgent((db) => db.getRecordIds(params));
  }

  private getRecordByIdWithCache = memoizee(
    async <T extends ELocalDBStoreNames>(
      params: ILocalDBGetRecordByIdParams<T>,
    ) => {
      const db = await this.getReadyDbForAdmittedOperation();
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
    return travelModeManager.getRuntimeEnvironmentSync().persistence.runSync({
      operation: () => {
        const allItemsInCache = this.dbAllRecordsCache.get(cacheKey) as T[];
        if (allItemsInCache && allItemsInCache.length) {
          return cloneDeep(allItemsInCache);
        }
        return undefined;
      },
      onBlocked: () => undefined,
    });
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
    return this.withTransaction(
      bucketName,
      (tx) => {
        return this.txRemoveRecords({
          ...params,
          tx,
        });
      },
      // Removing records frees space, so it must stay available while the
      // disk-full guard is raised.
      { allowWhenStorageFull: true },
    );
  }

  async txGetAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetAllRecordsParams<T>,
  ): Promise<ILocalDBTxGetAllRecordsResult<T>> {
    const result = await this.runWithProtectedAgent(
      (db) => db.txGetAllRecords(params),
      params.tx,
    );
    return this.normalizeCloudSyncGetResult({
      name: params.name,
      result,
    });
  }

  async txGetRecordsByIds<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordsByIdsParams<T>,
  ): Promise<ILocalDBTxGetRecordsByIdsResult<T>> {
    const result = await this.runWithProtectedAgent(
      (db) => db.txGetRecordsByIds(params),
      params.tx,
    );
    return this.normalizeCloudSyncGetResult({
      name: params.name,
      result,
    });
  }

  async txGetRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordByIdParams<T>,
  ): Promise<ILocalDBTxGetRecordByIdResult<T>> {
    const pair = await this.runWithProtectedAgent(
      (db) => db.txGetRecordById(params),
      params.tx,
    );
    if (params.name === ELocalDBStoreNames.CloudSyncItem) {
      return this.normalizeCloudSyncRecordPairDataTime(pair);
    }
    return pair;
  }

  async txGetRecordIds<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordIdsParams<T>,
  ): Promise<ILocalDBTxGetRecordIdsResult> {
    return this.runWithProtectedAgent(
      (db) => db.txGetRecordIds(params),
      params.tx,
    );
  }

  async txUpdateRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxUpdateRecordsParams<T>,
  ): Promise<void> {
    this.clearStoreCachedDataIfMatch(params.name);
    const dbTask = async (db: ILocalDBAgent) => {
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
    };
    return this.runWithProtectedAgent(dbTask, params.tx);
  }

  async txAddRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxAddRecordsParams<T>,
  ): Promise<ILocalDBTxAddRecordsResult> {
    this.clearStoreCachedDataIfMatch(params.name);
    return this.runWithProtectedAgent(async (db) => {
      if (params.name === ELocalDBStoreNames.CloudSyncItem) {
        return db.txAddRecords({
          ...params,
          records: params.records.map((record) =>
            this.normalizeCloudSyncRecordDataTime({ ...record }),
          ),
        });
      }
      return db.txAddRecords(params);
    }, params.tx);
  }

  async txRemoveRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxRemoveRecordsParams<T>,
  ): Promise<void> {
    this.clearStoreCachedDataIfMatch(params.name);
    return this.runWithProtectedAgent(
      (db) => db.txRemoveRecords(params),
      params.tx,
    );
  }

  abstract reset(): Promise<void>;

  async clearRecords(params: { name: ELocalDBStoreNames }) {
    this.clearStoreCachedDataIfMatch(params.name);
    return this.runWithProtectedAgent((db) => db.clearRecords(params));
  }
}
