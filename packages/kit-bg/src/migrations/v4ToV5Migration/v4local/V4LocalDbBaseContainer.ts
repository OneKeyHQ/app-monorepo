import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';

import { maskedV4LocalDbAgent } from './MaskedV4LocalDbAgent';

import type { IV4LocalDBAgent } from './IV4LocalDBAgent';
import type { EV4LocalDBStoreNames } from './v4localDBStoreNames';
import type {
  IV4LocalDBGetAllRecordsParams,
  IV4LocalDBGetAllRecordsResult,
  IV4LocalDBGetRecordByIdParams,
  IV4LocalDBGetRecordByIdResult,
  IV4LocalDBGetRecordsCountParams,
  IV4LocalDBGetRecordsCountResult,
  IV4LocalDBTransaction,
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

export abstract class V4LocalDbBaseContainer implements IV4LocalDBAgent {
  private transactionAgents = new WeakMap<object, IV4LocalDBAgent>();

  protected abstract getReadyDbForAdmittedOperation(): Promise<IV4LocalDBAgent>;

  private async runWithProtectedAgent<T>(
    task: (db: IV4LocalDBAgent) => Promise<T>,
    tx?: IV4LocalDBTransaction,
  ): Promise<T> {
    const transactionAgent = tx ? this.transactionAgents.get(tx) : undefined;
    if (transactionAgent) {
      return task(transactionAgent);
    }

    const environment = await travelModeManager.getRuntimeEnvironment();
    return environment.persistence.run({
      operation: async () => task(await this.getReadyDbForAdmittedOperation()),
      onBlocked: () => task(maskedV4LocalDbAgent),
    });
  }

  async withTransaction<T>(
    _task: IV4LocalDBWithTransactionTask<T>,
    _options?: IV4LocalDBWithTransactionOptions,
  ): Promise<T> {
    throw new OneKeyLocalError(
      'Directly call withTransaction() is NOT allowed at the V4 LocalDB container layer',
    );
  }

  protected async withProtectedTransaction<T>(
    task: IV4LocalDBWithTransactionTask<T>,
    options?: IV4LocalDBWithTransactionOptions,
  ): Promise<T> {
    const runTransaction = (db: IV4LocalDBAgent) =>
      db.withTransaction(async (tx) => {
        this.transactionAgents.set(tx, db);
        try {
          return await task(tx);
        } finally {
          this.transactionAgents.delete(tx);
        }
      }, options);
    const environment = await travelModeManager.getRuntimeEnvironment();
    return environment.persistence.run({
      operation: async () =>
        runTransaction(await this.getReadyDbForAdmittedOperation()),
      onBlocked: () => runTransaction(maskedV4LocalDbAgent),
    });
  }

  async getRecordsCount<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBGetRecordsCountParams<T>,
  ): Promise<IV4LocalDBGetRecordsCountResult> {
    return this.runWithProtectedAgent((db) => db.getRecordsCount(params));
  }

  async txGetRecordsCount<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxGetRecordsCountParams<T>,
  ): Promise<IV4LocalDBGetRecordsCountResult> {
    return this.runWithProtectedAgent(
      (db) => db.txGetRecordsCount(params),
      params.tx,
    );
  }

  async getAllRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBGetAllRecordsParams<T>,
  ): Promise<IV4LocalDBGetAllRecordsResult<T>> {
    return this.runWithProtectedAgent((db) => db.getAllRecords(params));
  }

  async getRecordById<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBGetRecordByIdParams<T>,
  ): Promise<IV4LocalDBGetRecordByIdResult<T>> {
    return this.runWithProtectedAgent((db) => db.getRecordById(params));
  }

  async txGetAllRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxGetAllRecordsParams<T>,
  ): Promise<IV4LocalDBTxGetAllRecordsResult<T>> {
    return this.runWithProtectedAgent(
      (db) => db.txGetAllRecords(params),
      params.tx,
    );
  }

  async txGetRecordById<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxGetRecordByIdParams<T>,
  ): Promise<IV4LocalDBTxGetRecordByIdResult<T>> {
    return this.runWithProtectedAgent(
      (db) => db.txGetRecordById(params),
      params.tx,
    );
  }

  async txUpdateRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxUpdateRecordsParams<T>,
  ): Promise<void> {
    return this.runWithProtectedAgent(
      (db) => db.txUpdateRecords(params),
      params.tx,
    );
  }

  async txAddRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxAddRecordsParams<T>,
  ): Promise<IV4LocalDBTxAddRecordsResult> {
    return this.runWithProtectedAgent(
      (db) => db.txAddRecords(params),
      params.tx,
    );
  }

  async txRemoveRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxRemoveRecordsParams<T>,
  ): Promise<void> {
    return this.runWithProtectedAgent(
      (db) => db.txRemoveRecords(params),
      params.tx,
    );
  }

  abstract reset(): Promise<void>;

  async clearRecords(params: { name: EV4LocalDBStoreNames }) {
    return this.runWithProtectedAgent((db) => db.clearRecords(params));
  }
}
