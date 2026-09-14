import { V4LocalDbAgentBase } from './V4LocalDbAgentBase';

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
  IV4LocalDBWithTransactionTask,
} from './v4localDBTypes';

export class MaskedV4LocalDbAgent extends V4LocalDbAgentBase {
  async withTransaction<T>(task: IV4LocalDBWithTransactionTask<T>): Promise<T> {
    return task({});
  }

  async clearRecords(_params: { name: EV4LocalDBStoreNames }): Promise<void> {}

  async getRecordsCount<T extends EV4LocalDBStoreNames>(
    _params: IV4LocalDBGetRecordsCountParams<T>,
  ): Promise<IV4LocalDBGetRecordsCountResult> {
    return { count: 0 };
  }

  async getAllRecords<T extends EV4LocalDBStoreNames>(
    _params: IV4LocalDBGetAllRecordsParams<T>,
  ): Promise<IV4LocalDBGetAllRecordsResult<T>> {
    return { records: [] };
  }

  async getRecordById<T extends EV4LocalDBStoreNames>(
    _params: IV4LocalDBGetRecordByIdParams<T>,
  ): Promise<IV4LocalDBGetRecordByIdResult<T>> {
    return undefined as unknown as IV4LocalDBGetRecordByIdResult<T>;
  }

  async txGetRecordsCount<T extends EV4LocalDBStoreNames>(
    _params: IV4LocalDBTxGetRecordsCountParams<T>,
  ): Promise<IV4LocalDBGetRecordsCountResult> {
    return { count: 0 };
  }

  async txGetAllRecords<T extends EV4LocalDBStoreNames>(
    _params: IV4LocalDBTxGetAllRecordsParams<T>,
  ): Promise<IV4LocalDBTxGetAllRecordsResult<T>> {
    return { recordPairs: [], records: [] };
  }

  async txGetRecordById<T extends EV4LocalDBStoreNames>(
    _params: IV4LocalDBTxGetRecordByIdParams<T>,
  ): Promise<IV4LocalDBTxGetRecordByIdResult<T>> {
    return [undefined, null] as unknown as IV4LocalDBTxGetRecordByIdResult<T>;
  }

  async txUpdateRecords<T extends EV4LocalDBStoreNames>(
    _params: IV4LocalDBTxUpdateRecordsParams<T>,
  ): Promise<void> {}

  async txAddRecords<T extends EV4LocalDBStoreNames>(
    _params: IV4LocalDBTxAddRecordsParams<T>,
  ): Promise<IV4LocalDBTxAddRecordsResult> {
    return { added: 0, addedIds: [], skipped: 0 };
  }

  async txRemoveRecords<T extends EV4LocalDBStoreNames>(
    _params: IV4LocalDBTxRemoveRecordsParams<T>,
  ): Promise<void> {}
}

export const maskedV4LocalDbAgent = new MaskedV4LocalDbAgent();
