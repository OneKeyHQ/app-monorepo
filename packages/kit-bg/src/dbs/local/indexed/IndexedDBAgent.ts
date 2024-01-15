import { isNil } from 'lodash';

import { noopObject } from '@onekeyhq/shared/src/utils/miscUtils';

import { ALL_LOCAL_DB_STORE_NAMES } from '../consts';
import { LocalDbAgentBase } from '../LocalDbAgentBase';
import { ELocalDBStoreNames } from '../localDBStoreNames';
import {
  type IIndexedDBSchemaMap,
  type ILocalDBGetAllRecordsParams,
  type ILocalDBGetAllRecordsResult,
  type ILocalDBGetRecordByIdParams,
  type ILocalDBGetRecordByIdResult,
  type ILocalDBRecord,
  type ILocalDBRecordPair,
  type ILocalDBRecordUpdater,
  type ILocalDBTransaction,
  type ILocalDBTransactionStores,
  type ILocalDBTxAddRecordsParams,
  type ILocalDBTxGetAllRecordsParams,
  type ILocalDBTxGetAllRecordsResult,
  type ILocalDBTxGetRecordByIdParams,
  type ILocalDBTxGetRecordByIdResult,
  type ILocalDBTxRemoveRecordsParams,
  type ILocalDBTxUpdateRecordsParams,
  type ILocalDBWithTransactionOptions,
  type ILocalDBWithTransactionTask,
} from '../types';

import type { IDBPDatabase, IDBPObjectStore, IDBPTransaction } from 'idb';

export class IndexedDBAgent extends LocalDbAgentBase {
  constructor(indexed: IDBPDatabase<IIndexedDBSchemaMap>) {
    super();
    this.indexed = indexed;
  }

  indexed: IDBPDatabase<IIndexedDBSchemaMap>;

  txPair:
    | {
        dbTx: IDBPTransaction<
          IIndexedDBSchemaMap,
          ELocalDBStoreNames[],
          'readwrite'
        >;
        tx: ILocalDBTransaction;
      }
    | undefined;

  _getObjectStore<T extends ELocalDBStoreNames>(
    tx: IDBPTransaction<IIndexedDBSchemaMap, T[], 'readwrite'>,
    storeName: T,
  ): IDBPObjectStore<IIndexedDBSchemaMap, T[], T, 'readwrite'> {
    const store = tx.objectStore(storeName);
    return store;
  }

  _getOrCreateObjectStore<T extends ELocalDBStoreNames>(
    tx: IDBPTransaction<IIndexedDBSchemaMap, T[], 'readwrite'>,
    storeName: T,
  ): IDBPObjectStore<IIndexedDBSchemaMap, T[], T, 'readwrite'> {
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
    db: IDBPDatabase<IIndexedDBSchemaMap>;
    alwaysCreate: boolean;
  }) {
    if (!this.txPair || alwaysCreate) {
      const dbTx = db.transaction(ALL_LOCAL_DB_STORE_NAMES, 'readwrite');

      const contextStore = this._getOrCreateObjectStore(
        dbTx,
        ELocalDBStoreNames.Context,
      );

      const walletStore = this._getOrCreateObjectStore(
        dbTx,
        ELocalDBStoreNames.Wallet,
      );

      const accountStore = this._getOrCreateObjectStore(
        dbTx,
        ELocalDBStoreNames.Account,
      );

      const accountDerivationStore = this._getOrCreateObjectStore(
        dbTx,
        ELocalDBStoreNames.AccountDerivation,
      );

      const indexedAccountStore = this._getOrCreateObjectStore(
        dbTx,
        ELocalDBStoreNames.IndexedAccount,
      );

      const credentialStore = this._getOrCreateObjectStore(
        dbTx,
        ELocalDBStoreNames.Credential,
      );

      const deviceStore = this._getOrCreateObjectStore(
        dbTx,
        ELocalDBStoreNames.Device,
      );

      const tx: ILocalDBTransaction = {
        stores: {
          [ELocalDBStoreNames.Context]: contextStore as any,
          [ELocalDBStoreNames.Wallet]: walletStore as any,
          [ELocalDBStoreNames.IndexedAccount]: indexedAccountStore as any,
          [ELocalDBStoreNames.Account]: accountStore as any,
          [ELocalDBStoreNames.AccountDerivation]: accountDerivationStore as any,
          [ELocalDBStoreNames.Credential]: credentialStore as any,
          [ELocalDBStoreNames.Device]: deviceStore as any,
        },
      };

      console.log('indexedDB _buildTransaction');

      this.txPair = {
        dbTx,
        tx,
      };
    }
    return this.txPair;
  }

  _getObjectStoreFromTx<T extends ELocalDBStoreNames>(
    tx: ILocalDBTransaction,
    storeName: T,
  ): ILocalDBTransactionStores[T] {
    const store = tx.stores?.[storeName];
    if (!store) {
      throw new Error(`indexedDB store not found: ${storeName}`);
    }
    return store;
  }

  async _executeUpdateRecord<T extends ELocalDBStoreNames>({
    name,
    updater,
    oldRecord,
    tx,
  }: {
    name: T;
    oldRecord: ILocalDBRecord<T>;
    updater: ILocalDBRecordUpdater<T>;
    tx: ILocalDBTransaction;
  }) {
    const store = this._getObjectStoreFromTx(tx, name);
    const newRecord = await updater(oldRecord);
    return store.put(newRecord as any);
  }

  // ----------------------------------------------

  async withTransaction<T>(
    task: ILocalDBWithTransactionTask<T>,
    options?: ILocalDBWithTransactionOptions,
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
      console.error(error);
      dbTx.abort();
      throw error;
    }
  }

  async getAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBGetAllRecordsParams<T>,
  ): Promise<ILocalDBGetAllRecordsResult<T>> {
    return this.withTransaction(async (tx) => {
      const { records } = await this.txGetAllRecords({
        ...params,
        tx,
      });
      return { records };
    });
  }

  async getRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordByIdParams<T>,
  ): Promise<ILocalDBGetRecordByIdResult<T>> {
    return this.withTransaction(async (tx) => {
      const [record] = await this.txGetRecordById({
        ...params,
        tx,
      });
      return record;
    });
  }

  async txGetAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetAllRecordsParams<T>,
  ): Promise<ILocalDBTxGetAllRecordsResult<T>> {
    const { tx: paramsTx, name } = params;
    const fn = async (tx: ILocalDBTransaction) => {
      const store = this._getObjectStoreFromTx(tx, name);
      // TODO add query support
      // query?: StoreKey<DBTypes, StoreName> | IDBKeyRange | null, count?: number
      const results = await store.getAll();
      const recordPairs: ILocalDBRecordPair<T>[] = [];
      const records: ILocalDBRecord<T>[] = [];

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

  async txGetRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordByIdParams<T>,
  ): Promise<ILocalDBTxGetRecordByIdResult<T>> {
    const { tx: paramsTx, name, id } = params;
    const fn: (
      tx: ILocalDBTransaction,
    ) => Promise<ILocalDBTxGetRecordByIdResult<T>> = async (
      tx: ILocalDBTransaction,
    ) => {
      const store = this._getObjectStoreFromTx(tx, name);
      const record = await store.get(id);
      if (!record) {
        throw new Error(`record not found: ${name} ${id}`);
      }
      return [record as any, null];
    };
    return fn(paramsTx);
  }

  async txUpdateRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxUpdateRecordsParams<T>,
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

  async txAddRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxAddRecordsParams<T>,
  ): Promise<void> {
    const { name, tx, records, skipIfExists } = params;
    const store = this._getObjectStoreFromTx(tx, name);
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
      }
    }
  }

  async txRemoveRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxRemoveRecordsParams<T>,
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
