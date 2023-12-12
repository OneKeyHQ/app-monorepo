import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { LocalDbAgentBase } from '../LocalDbAgentBase';

import type { RealmObjectBase } from './base/RealmObjectBase';
import type { ELocalDBStoreNames } from '../localDBStoreNames';
import type {
  ILocalDBAgent,
  ILocalDBGetAllRecordsParams,
  ILocalDBGetAllRecordsResult,
  ILocalDBGetRecordByIdParams,
  ILocalDBGetRecordByIdResult,
  ILocalDBRecord,
  ILocalDBRecordPair,
  ILocalDBTxAddRecordsParams,
  ILocalDBTxGetAllRecordsParams,
  ILocalDBTxGetAllRecordsResult,
  ILocalDBTxGetRecordByIdParams,
  ILocalDBTxGetRecordByIdResult,
  ILocalDBTxRemoveRecordsParams,
  ILocalDBTxUpdateRecordsParams,
  ILocalDBWithTransactionTask,
  IRealmDBSchemaMap,
} from '../types';
import type Realm from 'realm';

export class RealmDBAgent extends LocalDbAgentBase implements ILocalDBAgent {
  constructor(realm: Realm) {
    super();
    this.realm = realm;
  }

  realm: Realm;

  _getObjectRecordById<T extends ELocalDBStoreNames>(
    storeName: T,
    recordId: string,
  ) {
    checkIsDefined(storeName);
    console.log('realmdb _getObjectRecordById ', { storeName, recordId });
    const object = this.realm.objectForPrimaryKey<IRealmDBSchemaMap[T]>(
      storeName,
      recordId as any,
    );
    console.log('realmdb _getObjectRecordById ', object);
    return object;
  }

  _getOrAddObjectRecord<T extends ELocalDBStoreNames>(
    storeName: T,
    record: IRealmDBSchemaMap[T] extends RealmObjectBase<infer U> ? U : never,
  ) {
    // @ts-ignore
    const recordId = record?.id;
    let obj = this._getObjectRecordById(storeName, recordId);
    if (!obj) {
      // this code won't auto commit create transaction, you should wrap withTransaction() outside
      this.realm.create(storeName, record as any);
    }
    obj = this._getObjectRecordById(storeName, recordId);
    return obj;
  }

  // ----------------------------------------------

  async withTransaction<T>(task: ILocalDBWithTransactionTask<T>): Promise<T> {
    this.realm.beginTransaction();
    try {
      const tx = {};
      const result = await task(tx);
      this.realm.commitTransaction();
      return result;
    } catch (error) {
      this.realm.cancelTransaction();
      throw error;
    }
  }

  async getAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBGetAllRecordsParams<T>,
  ): Promise<ILocalDBGetAllRecordsResult<T>> {
    return this.withTransaction(async (tx) => {
      const { records } = await this.txGetAllRecords({ ...params, tx });
      return { records };
    });
  }

  async getRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordByIdParams<T>,
  ): Promise<ILocalDBGetRecordByIdResult<T>> {
    return this.withTransaction(async (tx) => {
      const [record] = await this.txGetRecordById({ ...params, tx });
      return record;
    });
  }

  async txGetAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetAllRecordsParams<T>,
  ): Promise<ILocalDBTxGetAllRecordsResult<T>> {
    const { name } = params;
    const objList = this.realm.objects<IRealmDBSchemaMap[T]>(name);
    const recordPairs: ILocalDBRecordPair<T>[] = [];
    const records: ILocalDBRecord<T>[] = [];
    objList.forEach((obj) => {
      recordPairs.push([obj.record as any, obj]);
      records.push(obj.record as any);
    });

    return Promise.resolve({
      recordPairs,
      records,
    });
  }

  async txGetRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordByIdParams<T>,
  ): Promise<ILocalDBTxGetRecordByIdResult<T>> {
    const { id, name } = params;
    const obj = this._getObjectRecordById(name, id);
    const record = obj?.record;
    if (!record) {
      throw new Error(`record not found: ${name} ${id}`);
    }
    return [record as any, obj];
  }

  async txUpdateRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxUpdateRecordsParams<T>,
  ): Promise<void> {
    const { tx, updater } = params;
    checkIsDefined(tx);

    const pairs = await this.buildRecordPairsFromIds(params);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await Promise.all(pairs.map(async (oldRecord) => updater(oldRecord[1]!)));
    return Promise.resolve(undefined);
  }

  async txAddRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxAddRecordsParams<T>,
  ): Promise<void> {
    const { name, records, skipIfExists } = params;
    checkIsDefined(params.tx);
    checkIsDefined(params.name);

    records.forEach((r) => {
      let shouldAdd = true;
      if (skipIfExists) {
        const existingRecord = this._getObjectRecordById(name, r.id);
        if (existingRecord) {
          shouldAdd = false;
        }
      }
      if (shouldAdd) {
        this.realm.create(name, r);
      }
    });
    return Promise.resolve(undefined);
  }

  async txRemoveRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxRemoveRecordsParams<T>,
  ): Promise<void> {
    checkIsDefined(params.tx);
    const pairs = await this.buildRecordPairsFromIds(params);

    this.realm.delete(pairs.map((pair) => pair[1]));
    return Promise.resolve(undefined);
  }
}
