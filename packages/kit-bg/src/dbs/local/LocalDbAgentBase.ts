import { isNil } from 'lodash';

import type { ELocalDBStoreNames } from './localDBStoreNames';
import type {
  ILocalDBAgent,
  ILocalDBGetAllRecordsParams,
  ILocalDBGetAllRecordsResult,
  ILocalDBGetRecordByIdParams,
  ILocalDBGetRecordByIdResult,
  ILocalDBGetRecordsCountParams,
  ILocalDBGetRecordsCountResult,
  ILocalDBRecordPair,
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

export abstract class LocalDbAgentBase implements ILocalDBAgent {
  async buildRecordPairsFromIds<T extends ELocalDBStoreNames>({
    recordPairs,
    ids,
    tx,
    name,
    ignoreNotFound,
  }: ILocalDBTxRemoveRecordsParams<T>) {
    if (isNil(ids) && isNil(recordPairs)) {
      throw new Error(
        'dbUpdateRecord ERROR: ids and recordPairs both not found',
      );
    }
    let pairs: ILocalDBRecordPair<T>[] = [];
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

  abstract withTransaction<T>(task: ILocalDBWithTransactionTask<T>): Promise<T>;

  abstract clearRecords(params: { name: ELocalDBStoreNames }): Promise<void>;

  abstract getRecordsCount<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordsCountParams<T>,
  ): Promise<ILocalDBGetRecordsCountResult>;

  // TODO get with query
  abstract getAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBGetAllRecordsParams<T>,
  ): Promise<ILocalDBGetAllRecordsResult<T>>;

  abstract getRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordByIdParams<T>,
  ): Promise<ILocalDBGetRecordByIdResult<T>>;

  abstract txGetRecordsCount<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordsCountParams<T>,
  ): Promise<ILocalDBGetRecordsCountResult>;

  abstract txGetAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetAllRecordsParams<T>,
  ): Promise<ILocalDBTxGetAllRecordsResult<T>>;

  abstract txGetRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordByIdParams<T>,
  ): Promise<ILocalDBTxGetRecordByIdResult<T>>;

  // TODO batch update/add/remove
  abstract txUpdateRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxUpdateRecordsParams<T>,
  ): Promise<void>;

  abstract txAddRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxAddRecordsParams<T>,
  ): Promise<ILocalDBTxAddRecordsResult>;

  abstract txRemoveRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxRemoveRecordsParams<T>,
  ): Promise<void>;
}
