import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { ELocalDBStoreNames } from './localDBStoreNames';

import type {
  ILocalDBAgent,
  ILocalDBGetAllRecordsParams,
  ILocalDBGetAllRecordsResult,
  ILocalDBGetRecordByIdParams,
  ILocalDBGetRecordByIdResult,
  ILocalDBGetRecordsCountParams,
  ILocalDBGetRecordsCountResult,
  ILocalDBTxAddRecordsParams,
  ILocalDBTxAddRecordsResult,
  ILocalDBTxGetAllRecordsParams,
  ILocalDBTxGetAllRecordsResult,
  ILocalDBTxGetRecordByIdParams,
  ILocalDBTxGetRecordByIdResult,
  ILocalDBTxGetRecordsCountParams,
  ILocalDBTxRemoveRecordsParams,
  ILocalDBTxUpdateRecordsParams,
  ILocalDBWithTransactionTask,
} from './types';

export abstract class LocalDbBaseContainer implements ILocalDBAgent {
  protected abstract readyDb: Promise<ILocalDBAgent>;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async withTransaction<T>(task: ILocalDBWithTransactionTask<T>): Promise<T> {
    throw new Error(
      'Directly call withTransaction() is NOT allowed, please use (await this.readyDb).withTransaction() at DB layer',
    );
    // const db = await this.readyDb;
    // return db.withTransaction(task);
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
    return db.getAllRecords(params);
  }

  async getRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordByIdParams<T>,
  ): Promise<ILocalDBGetRecordByIdResult<T>> {
    if (this.isCachedStoreName(params.name)) {
      return this.getRecordByIdWithCache(params);
    }
    const db = await this.readyDb;
    return db.getRecordById(params);
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

  clearStoreCachedData(storeName: ELocalDBStoreNames) {
    if (this.isCachedStoreName(storeName)) {
      this.getRecordByIdWithCache.clear();
    }
  }

  async txGetAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetAllRecordsParams<T>,
  ): Promise<ILocalDBTxGetAllRecordsResult<T>> {
    const db = await this.readyDb;
    return db.txGetAllRecords(params);
  }

  async txGetRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordByIdParams<T>,
  ): Promise<ILocalDBTxGetRecordByIdResult<T>> {
    const db = await this.readyDb;
    return db.txGetRecordById(params);
  }

  async txUpdateRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxUpdateRecordsParams<T>,
  ): Promise<void> {
    this.clearStoreCachedData(params.name);
    const db = await this.readyDb;
    // const a = db.txAddRecords['hello-world-test-error-stack-8889273']['name'];
    return db.txUpdateRecords(params);
  }

  async txAddRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxAddRecordsParams<T>,
  ): Promise<ILocalDBTxAddRecordsResult> {
    this.clearStoreCachedData(params.name);
    const db = await this.readyDb;
    return db.txAddRecords(params);
  }

  async txRemoveRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxRemoveRecordsParams<T>,
  ): Promise<void> {
    this.clearStoreCachedData(params.name);
    const db = await this.readyDb;
    return db.txRemoveRecords(params);
  }

  abstract reset(): Promise<void>;

  async clearRecords(params: { name: ELocalDBStoreNames }) {
    this.clearStoreCachedData(params.name);
    const db = await this.readyDb;
    return db.clearRecords(params);
  }
}
