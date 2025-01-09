import type { EV4LocalDBStoreNames } from './v4localDBStoreNames';
import type {
  IV4LocalDBGetAllRecordsParams,
  IV4LocalDBGetAllRecordsResult,
  IV4LocalDBGetRecordByIdParams,
  IV4LocalDBGetRecordByIdResult,
  IV4LocalDBGetRecordsCountParams,
  IV4LocalDBGetRecordsCountResult,
  IV4LocalDBTxAddRecordsParams,
  IV4LocalDBTxAddRecordsResult,
  IV4LocalDBTxGetAllRecordsParams,
  IV4LocalDBTxGetAllRecordsResult,
  IV4LocalDBTxGetRecordByIdParams,
  IV4LocalDBTxGetRecordByIdResult,
  IV4LocalDBTxGetRecordsCountParams,
  IV4LocalDBTxRemoveRecordsParams,
  IV4LocalDBTxUpdateRecordsParams,
  IV4LocalDBWithTransactionOptions,
  IV4LocalDBWithTransactionTask,
} from './v4localDBTypes';

export interface IV4LocalDBAgent {
  withTransaction<T>(
    task: IV4LocalDBWithTransactionTask<T>,
    options?: IV4LocalDBWithTransactionOptions,
  ): Promise<T>;

  clearRecords(params: { name: EV4LocalDBStoreNames }): Promise<void>;

  getRecordsCount<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBGetRecordsCountParams<T>,
  ): Promise<IV4LocalDBGetRecordsCountResult>;

  // TODO get with query
  getAllRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBGetAllRecordsParams<T>,
  ): Promise<IV4LocalDBGetAllRecordsResult<T>>;

  getRecordById<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBGetRecordByIdParams<T>,
  ): Promise<IV4LocalDBGetRecordByIdResult<T>>;

  txGetRecordsCount<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxGetRecordsCountParams<T>,
  ): Promise<IV4LocalDBGetRecordsCountResult>;

  txGetAllRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxGetAllRecordsParams<T>,
  ): Promise<IV4LocalDBTxGetAllRecordsResult<T>>;

  txGetRecordById<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxGetRecordByIdParams<T>,
  ): Promise<IV4LocalDBTxGetRecordByIdResult<T>>;

  // TODO batch update/add/remove
  txUpdateRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxUpdateRecordsParams<T>,
  ): Promise<void>;

  txAddRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxAddRecordsParams<T>,
  ): Promise<IV4LocalDBTxAddRecordsResult>;

  txRemoveRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxRemoveRecordsParams<T>,
  ): Promise<void>;
}
