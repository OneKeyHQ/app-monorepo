import { isNil } from 'lodash';

import type { IV4LocalDBAgent } from './IV4LocalDBAgent';
import type { EV4LocalDBStoreNames } from './v4localDBStoreNames';
import type {
  IV4LocalDBGetAllRecordsParams,
  IV4LocalDBGetAllRecordsResult,
  IV4LocalDBGetRecordByIdParams,
  IV4LocalDBGetRecordByIdResult,
  IV4LocalDBGetRecordsCountParams,
  IV4LocalDBGetRecordsCountResult,
  IV4LocalDBRecordPair,
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

export abstract class V4LocalDbAgentBase implements IV4LocalDBAgent {
  async buildRecordPairsFromIds<T extends EV4LocalDBStoreNames>({
    recordPairs,
    ids,
    tx,
    name,
    ignoreNotFound,
  }: IV4LocalDBTxRemoveRecordsParams<T>) {
    if (isNil(ids) && isNil(recordPairs)) {
      throw new Error(
        'dbUpdateRecord ERROR: ids and recordPairs both not found',
      );
    }
    let pairs: IV4LocalDBRecordPair<T>[] = [];
    if (!isNil(ids)) {
      const pairsFromIds = await Promise.all(
        ids.map(async (id) => {
          try {
            // TODO use txGetRecordByIdSafe
            return await this.txGetRecordById({
              id,
              name,
              tx,
            });
          } catch (error) {
            if (ignoreNotFound) {
              return Promise.resolve(null);
            }
            throw error;
          }
        }),
      );
      pairs = pairs.concat(pairsFromIds.filter(Boolean));
    }
    if (!isNil(recordPairs)) {
      pairs = pairs.concat(recordPairs);
    }

    return pairs;
  }

  abstract withTransaction<T>(
    task: IV4LocalDBWithTransactionTask<T>,
  ): Promise<T>;

  abstract clearRecords(params: { name: EV4LocalDBStoreNames }): Promise<void>;

  abstract getRecordsCount<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBGetRecordsCountParams<T>,
  ): Promise<IV4LocalDBGetRecordsCountResult>;

  // TODO get with query
  abstract getAllRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBGetAllRecordsParams<T>,
  ): Promise<IV4LocalDBGetAllRecordsResult<T>>;

  abstract getRecordById<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBGetRecordByIdParams<T>,
  ): Promise<IV4LocalDBGetRecordByIdResult<T>>;

  abstract txGetRecordsCount<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxGetRecordsCountParams<T>,
  ): Promise<IV4LocalDBGetRecordsCountResult>;

  abstract txGetAllRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxGetAllRecordsParams<T>,
  ): Promise<IV4LocalDBTxGetAllRecordsResult<T>>;

  abstract txGetRecordById<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxGetRecordByIdParams<T>,
  ): Promise<IV4LocalDBTxGetRecordByIdResult<T>>;

  // TODO batch update/add/remove
  abstract txUpdateRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxUpdateRecordsParams<T>,
  ): Promise<void>;

  abstract txAddRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxAddRecordsParams<T>,
  ): Promise<IV4LocalDBTxAddRecordsResult>;

  abstract txRemoveRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxRemoveRecordsParams<T>,
  ): Promise<void>;
}
