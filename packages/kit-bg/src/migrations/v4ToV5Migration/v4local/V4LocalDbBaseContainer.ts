import type { IV4LocalDBAgent } from './IV4LocalDBAgent';
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

export abstract class V4LocalDbBaseContainer implements IV4LocalDBAgent {
  protected abstract readyDb: Promise<IV4LocalDBAgent>;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async withTransaction<T>(task: IV4LocalDBWithTransactionTask<T>): Promise<T> {
    throw new Error(
      'Directly call withTransaction() is NOT allowed, please use (await this.readyDb).withTransaction() at DB layer',
    );
    // const db = await this.readyDb;
    // return db.withTransaction(task);
  }

  async getRecordsCount<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBGetRecordsCountParams<T>,
  ): Promise<IV4LocalDBGetRecordsCountResult> {
    const db = await this.readyDb;
    return db.getRecordsCount(params);
  }

  async txGetRecordsCount<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxGetRecordsCountParams<T>,
  ): Promise<IV4LocalDBGetRecordsCountResult> {
    const db = await this.readyDb;
    return db.txGetRecordsCount(params);
  }

  async getAllRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBGetAllRecordsParams<T>,
  ): Promise<IV4LocalDBGetAllRecordsResult<T>> {
    const db = await this.readyDb;
    return db.getAllRecords(params);
  }

  async getRecordById<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBGetRecordByIdParams<T>,
  ): Promise<IV4LocalDBGetRecordByIdResult<T>> {
    const db = await this.readyDb;
    return db.getRecordById(params);
  }

  async txGetAllRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxGetAllRecordsParams<T>,
  ): Promise<IV4LocalDBTxGetAllRecordsResult<T>> {
    const db = await this.readyDb;
    return db.txGetAllRecords(params);
  }

  async txGetRecordById<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxGetRecordByIdParams<T>,
  ): Promise<IV4LocalDBTxGetRecordByIdResult<T>> {
    const db = await this.readyDb;
    return db.txGetRecordById(params);
  }

  async txUpdateRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxUpdateRecordsParams<T>,
  ): Promise<void> {
    const db = await this.readyDb;
    // const a = db.txAddRecords['hello-world-test-error-stack-8889273']['name'];
    return db.txUpdateRecords(params);
  }

  async txAddRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxAddRecordsParams<T>,
  ): Promise<IV4LocalDBTxAddRecordsResult> {
    const db = await this.readyDb;
    return db.txAddRecords(params);
  }

  async txRemoveRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxRemoveRecordsParams<T>,
  ): Promise<void> {
    const db = await this.readyDb;
    return db.txRemoveRecords(params);
  }

  abstract reset(): Promise<void>;

  async clearRecords(params: { name: EV4LocalDBStoreNames }) {
    const db = await this.readyDb;
    return db.clearRecords(params);
  }
}
