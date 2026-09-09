import { LocalDbAgentBase } from './LocalDbAgentBase';

import type { ELocalDBStoreNames } from './localDBStoreNames';
import type {
  EIndexedDBBucketNames,
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
  ILocalDBTransaction,
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

/**
 * Storage-free LocalDB implementation used while Travel Mode masks business
 * data. It owns no Realm/IndexedDB handle and deliberately executes transaction
 * callbacks so callers can still compute non-persisted return values.
 */
export class MaskedLocalDbAgent extends LocalDbAgentBase {
  async withTransaction<T>(
    bucketName: EIndexedDBBucketNames,
    task: ILocalDBWithTransactionTask<T>,
    _options?: ILocalDBWithTransactionOptions,
  ): Promise<T> {
    const tx: ILocalDBTransaction = { bucketName };
    return task(tx);
  }

  async clearRecords(_params: { name: ELocalDBStoreNames }): Promise<void> {}

  async getRecordsCount<T extends ELocalDBStoreNames>(
    _params: ILocalDBGetRecordsCountParams<T>,
  ): Promise<ILocalDBGetRecordsCountResult> {
    return { count: 0 };
  }

  async getRecordsByIds<T extends ELocalDBStoreNames>(
    _params: ILocalDBGetRecordsByIdsParams<T>,
  ): Promise<ILocalDBGetRecordsByIdsResult<T>> {
    return { records: [] };
  }

  async getAllRecords<T extends ELocalDBStoreNames>(
    _params: ILocalDBGetAllRecordsParams<T>,
  ): Promise<ILocalDBGetAllRecordsResult<T>> {
    return { records: [] };
  }

  async getRecordById<T extends ELocalDBStoreNames>(
    _params: ILocalDBGetRecordByIdParams<T>,
  ): Promise<ILocalDBGetRecordByIdResult<T>> {
    return undefined;
  }

  async getRecordIds<T extends ELocalDBStoreNames>(
    _params: ILocalDBGetRecordIdsParams<T>,
  ): Promise<ILocalDBGetRecordIdsResult> {
    return [];
  }

  async txGetRecordsCount<T extends ELocalDBStoreNames>(
    _params: ILocalDBTxGetRecordsCountParams<T>,
  ): Promise<ILocalDBGetRecordsCountResult> {
    return { count: 0 };
  }

  async txGetRecordsByIds<T extends ELocalDBStoreNames>(
    _params: ILocalDBTxGetRecordsByIdsParams<T>,
  ): Promise<ILocalDBTxGetRecordsByIdsResult<T>> {
    return { recordPairs: [], records: [] };
  }

  async txGetAllRecords<T extends ELocalDBStoreNames>(
    _params: ILocalDBTxGetAllRecordsParams<T>,
  ): Promise<ILocalDBTxGetAllRecordsResult<T>> {
    return { recordPairs: [], records: [] };
  }

  async txGetRecordById<T extends ELocalDBStoreNames>(
    _params: ILocalDBTxGetRecordByIdParams<T>,
  ): Promise<ILocalDBTxGetRecordByIdResult<T>> {
    return [undefined, null];
  }

  async txUpdateRecords<T extends ELocalDBStoreNames>(
    _params: ILocalDBTxUpdateRecordsParams<T>,
  ): Promise<void> {}

  async txAddRecords<T extends ELocalDBStoreNames>(
    _params: ILocalDBTxAddRecordsParams<T>,
  ): Promise<ILocalDBTxAddRecordsResult> {
    return { added: 0, addedIds: [], skipped: 0 };
  }

  async txGetRecordIds<T extends ELocalDBStoreNames>(
    _params: ILocalDBTxGetRecordIdsParams<T>,
  ): Promise<ILocalDBTxGetRecordIdsResult> {
    return [];
  }

  async txRemoveRecords<T extends ELocalDBStoreNames>(
    _params: ILocalDBTxRemoveRecordsParams<T>,
  ): Promise<void> {}
}

export const maskedLocalDbAgent = new MaskedLocalDbAgent();
