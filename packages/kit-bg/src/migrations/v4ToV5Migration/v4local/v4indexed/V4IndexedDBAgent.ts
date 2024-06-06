import { isNil, isNumber } from 'lodash';

import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { noopObject } from '@onekeyhq/shared/src/utils/miscUtils';

import { V4LocalDbAgentBase } from '../V4LocalDbAgentBase';
import { V4_ALL_LOCAL_DB_STORE_NAMES } from '../v4localDBConsts';
import { EV4LocalDBStoreNames } from '../v4localDBStoreNames';

import type { IV4LocalDBAgent } from '../IV4LocalDBAgent';
import type {
  IV4IndexedDBSchemaMap,
  IV4LocalDBGetAllRecordsParams,
  IV4LocalDBGetAllRecordsResult,
  IV4LocalDBGetRecordByIdParams,
  IV4LocalDBGetRecordByIdResult,
  IV4LocalDBGetRecordsCountParams,
  IV4LocalDBGetRecordsCountResult,
  IV4LocalDBRecord,
  IV4LocalDBRecordPair,
  IV4LocalDBRecordUpdater,
  IV4LocalDBTransaction,
  IV4LocalDBTransactionStores,
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
} from '../v4localDBTypes';
import type { IDBPDatabase, IDBPObjectStore, IDBPTransaction } from 'idb';

export class V4IndexedDBAgent
  extends V4LocalDbAgentBase
  implements IV4LocalDBAgent
{
  constructor(indexed: IDBPDatabase<IV4IndexedDBSchemaMap>) {
    super();
    this.indexed = indexed;
  }

  clearRecords({ name }: { name: EV4LocalDBStoreNames }): Promise<void> {
    return this.withTransaction(async (tx) => {
      const store = this._getObjectStoreFromTx(tx, name);
      await store.clear();
    });
  }

  indexed: IDBPDatabase<IV4IndexedDBSchemaMap>;

  txPair:
    | {
        dbTx: IDBPTransaction<
          IV4IndexedDBSchemaMap,
          EV4LocalDBStoreNames[],
          'readwrite'
        >;
        tx: IV4LocalDBTransaction;
      }
    | undefined;

  _getObjectStore<T extends EV4LocalDBStoreNames>(
    tx: IDBPTransaction<IV4IndexedDBSchemaMap, T[], 'readwrite'>,
    storeName: T,
  ): IDBPObjectStore<IV4IndexedDBSchemaMap, T[], T, 'readwrite'> {
    const store = tx.objectStore(storeName);
    return store;
  }

  _getOrCreateObjectStore<T extends EV4LocalDBStoreNames>(
    tx: IDBPTransaction<IV4IndexedDBSchemaMap, T[], 'readwrite'>,
    storeName: T,
  ): IDBPObjectStore<IV4IndexedDBSchemaMap, T[], T, 'readwrite'> {
    try {
      const store = this._getObjectStore(tx, storeName);
      // const dd = await store.get('');
      return store;
    } catch {
      this.indexed.createObjectStore(storeName, {
        keyPath: 'id',
      });
      const store = this._getObjectStore(tx, storeName);
      return store;
    }
  }

  _buildTransactionAndStores({
    db,
    alwaysCreate = true,
  }: {
    db: IDBPDatabase<IV4IndexedDBSchemaMap>;
    alwaysCreate: boolean;
  }) {
    if (!this.txPair || alwaysCreate) {
      const dbTx = db.transaction(V4_ALL_LOCAL_DB_STORE_NAMES, 'readwrite');

      const contextStore = this._getOrCreateObjectStore(
        dbTx,
        EV4LocalDBStoreNames.Context,
      );

      const walletStore = this._getOrCreateObjectStore(
        dbTx,
        EV4LocalDBStoreNames.Wallet,
      );

      const accountStore = this._getOrCreateObjectStore(
        dbTx,
        EV4LocalDBStoreNames.Account,
      );

      const accountDerivationStore = this._getOrCreateObjectStore(
        dbTx,
        EV4LocalDBStoreNames.AccountDerivation,
      );

      const credentialStore = this._getOrCreateObjectStore(
        dbTx,
        EV4LocalDBStoreNames.Credential,
      );

      const deviceStore = this._getOrCreateObjectStore(
        dbTx,
        EV4LocalDBStoreNames.Device,
      );

      const tx: IV4LocalDBTransaction = {
        stores: {
          [EV4LocalDBStoreNames.Context]: contextStore as any,
          [EV4LocalDBStoreNames.Wallet]: walletStore as any,
          [EV4LocalDBStoreNames.Account]: accountStore as any,
          [EV4LocalDBStoreNames.AccountDerivation]:
            accountDerivationStore as any,
          [EV4LocalDBStoreNames.Credential]: credentialStore as any,
          [EV4LocalDBStoreNames.Device]: deviceStore as any,
        },
      };

      this.txPair = {
        dbTx,
        tx,
      };
    }
    return this.txPair;
  }

  _getObjectStoreFromTx<T extends EV4LocalDBStoreNames>(
    tx: IV4LocalDBTransaction,
    storeName: T,
  ): IV4LocalDBTransactionStores[T] {
    const store = tx.stores?.[storeName];
    if (!store) {
      throw new Error(`indexedDB store not found: ${storeName}`);
    }
    return store;
  }

  async _executeUpdateRecord<T extends EV4LocalDBStoreNames>({
    name,
    updater,
    oldRecord,
    tx,
  }: {
    name: T;
    oldRecord: IV4LocalDBRecord<T>;
    updater: IV4LocalDBRecordUpdater<T>;
    tx: IV4LocalDBTransaction;
  }) {
    const store = this._getObjectStoreFromTx(tx, name);
    const newRecord = await updater(oldRecord);
    return store.put(newRecord as any);
  }

  // ----------------------------------------------

  async withTransaction<T>(
    task: IV4LocalDBWithTransactionTask<T>,
    options?: IV4LocalDBWithTransactionOptions,
  ): Promise<T> {
    noopObject(options);
    const { tx, dbTx } = this._buildTransactionAndStores({
      db: this.indexed,
      alwaysCreate: true,
    });

    try {
      const result = await task(tx);
      // await dbTx.done;
      return result;
    } catch (error) {
      // console.error(error);
      dbTx.abort();
      throw error;
    }
  }

  override async getRecordsCount<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBGetRecordsCountParams<T>,
  ): Promise<IV4LocalDBGetRecordsCountResult> {
    return this.withTransaction(async (tx) =>
      this.txGetRecordsCount({
        ...params,
        tx,
      }),
    );
  }

  async getAllRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBGetAllRecordsParams<T>,
  ): Promise<IV4LocalDBGetAllRecordsResult<T>> {
    return this.withTransaction(async (tx) => {
      const { records } = await this.txGetAllRecords({
        ...params,
        tx,
      });
      return { records };
    });
  }

  async getRecordById<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBGetRecordByIdParams<T>,
  ): Promise<IV4LocalDBGetRecordByIdResult<T>> {
    return this.withTransaction(async (tx) => {
      const [record] = await this.txGetRecordById({
        ...params,
        tx,
      });
      return record;
    });
  }

  override async txGetRecordsCount<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxGetRecordsCountParams<T>,
  ): Promise<IV4LocalDBGetRecordsCountResult> {
    const { tx: paramsTx, name } = params;
    const fn = async (tx: IV4LocalDBTransaction) => {
      const store = this._getObjectStoreFromTx(tx, name);
      const count = await store.count();
      return {
        count,
      };
    };
    return fn(paramsTx);
  }

  async txGetAllRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxGetAllRecordsParams<T>,
  ): Promise<IV4LocalDBTxGetAllRecordsResult<T>> {
    const { tx: paramsTx, name, ids, limit, offset } = params;
    const fn = async (tx: IV4LocalDBTransaction) => {
      const store = this._getObjectStoreFromTx<T>(tx, name);
      // TODO add query support
      // query?: StoreKey<DBTypes, StoreName> | IDBKeyRange | null, count?: number
      let results: unknown[] = [];

      if (ids) {
        results = await Promise.all(ids.map((id) => store.get(id)));
      } else if (isNumber(limit) && isNumber(offset)) {
        const indexStore = store;
        if (indexStore.indexNames.contains('createdAt' as never)) {
          const cursor = await indexStore
            .index('createdAt' as never)
            .openCursor(null, 'prev');

          let skipped = 0;
          while (cursor) {
            if (skipped < offset) {
              skipped += 1;
            } else if (results.length <= limit) {
              results.push(cursor.value);
            }
            const data = await cursor.continue();
            if (!data || results.length >= limit) {
              break;
            }
          }
        } else {
          results = await store.getAll();
        }
      } else {
        results = await store.getAll();
      }

      const recordPairs: IV4LocalDBRecordPair<T>[] = [];
      const records: IV4LocalDBRecord<T>[] = [];

      results.forEach((record) => {
        records.push(record as any);
        recordPairs.push([record as any, null]);
      });
      return {
        recordPairs,
        records,
      };
    };

    return fn(paramsTx);
  }

  async txGetRecordById<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxGetRecordByIdParams<T>,
  ): Promise<IV4LocalDBTxGetRecordByIdResult<T>> {
    const { tx: paramsTx, name, id } = params;
    const fn: (
      tx: IV4LocalDBTransaction,
    ) => Promise<IV4LocalDBTxGetRecordByIdResult<T>> = async (
      tx: IV4LocalDBTransaction,
    ) => {
      const store = this._getObjectStoreFromTx(tx, name);
      const record = await store.get(id);
      if (!record) {
        const error = new Error(`record not found: ${name} ${id}`);
        errorUtils.autoPrintErrorIgnore(error);
        throw error;
      }
      return [record as any, null];
    };
    return fn(paramsTx);
  }

  async txUpdateRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxUpdateRecordsParams<T>,
  ): Promise<void> {
    const { name, tx, updater } = params;
    const pairs = await this.buildRecordPairsFromIds(params);
    await Promise.all(
      pairs.map((pair) =>
        this._executeUpdateRecord({
          name,
          tx,
          updater,
          oldRecord: pair[0],
        }),
      ),
    );
  }

  async txAddRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxAddRecordsParams<T>,
  ): Promise<IV4LocalDBTxAddRecordsResult> {
    const { name, tx, records, skipIfExists } = params;
    const store = this._getObjectStoreFromTx(tx, name);
    const result: IV4LocalDBTxAddRecordsResult = {
      added: 0,
      skipped: 0,
      addedIds: [],
    };
    for (const record of records) {
      let shouldAdd = true;
      if (skipIfExists) {
        const existingRecord = await store.get(record.id);
        if (existingRecord) {
          shouldAdd = false;
        }
      }
      if (shouldAdd) {
        await store.add(record as any);
        result.added += 1;
        result.addedIds.push(record.id);
      } else {
        result.skipped += 1;
      }
    }
    return result;
  }

  async txRemoveRecords<T extends EV4LocalDBStoreNames>(
    params: IV4LocalDBTxRemoveRecordsParams<T>,
  ): Promise<void> {
    const { name, tx } = params;
    const store = this._getObjectStoreFromTx(tx, name);
    const pairs = await this.buildRecordPairsFromIds(params);
    await Promise.all(
      pairs.map(async (pair) => {
        const recordId = pair[0]?.id;
        if (isNil(recordId)) {
          throw new Error('dbRemoveRecord ERROR: recordId not found');
        }
        return store.delete(recordId);
      }),
    );
  }
}
