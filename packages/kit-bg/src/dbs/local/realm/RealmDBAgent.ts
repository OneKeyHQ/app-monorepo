import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { LocalDbAgentBase } from '../LocalDbAgentBase';

import { realmDBSchemasMap } from './schemas';

import type { RealmObjectBase } from './base/RealmObjectBase';
import type { ELocalDBStoreNames } from '../localDBStoreNames';
import type {
  ILocalDBAgent,
  ILocalDBGetAllRecordsParams,
  ILocalDBGetAllRecordsResult,
  ILocalDBGetRecordByIdParams,
  ILocalDBGetRecordByIdResult,
  ILocalDBGetRecordsCountParams,
  ILocalDBGetRecordsCountResult,
  ILocalDBRecord,
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
  ILocalDBWithTransactionOptions,
  ILocalDBWithTransactionTask,
  IRealmDBSchemaMap,
} from '../types';
import type Realm from 'realm';

export class RealmDBAgent extends LocalDbAgentBase implements ILocalDBAgent {
  constructor(realm: Realm) {
    super();
    this.realm = realm;
  }

  async clearRecords({ name }: { name: ELocalDBStoreNames }): Promise<void> {
    await this.withTransaction(async (tx) => {
      const { recordPairs } = await this.txGetAllRecords({ name, tx });
      await this.txRemoveRecords({
        tx,
        name,
        recordPairs,
      });
    });
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

  async withTransaction<T>(
    task: ILocalDBWithTransactionTask<T>,
    options?: ILocalDBWithTransactionOptions,
  ): Promise<T> {
    if (!options?.readOnly) {
      this.realm.beginTransaction();
    }
    try {
      const tx = {};
      const result = await task(tx);
      if (!options?.readOnly) {
        this.realm.commitTransaction();
      }
      return result;
    } catch (error) {
      if (!options?.readOnly) {
        this.realm.cancelTransaction();
      }
      throw error;
    }
  }

  async getRecordsCount<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordsCountParams<T>,
  ): Promise<ILocalDBGetRecordsCountResult> {
    return this.withTransaction(
      async (tx) => {
        const { count } = await this.txGetRecordsCount({ ...params, tx });
        return { count };
      },
      { readOnly: true },
    );
  }

  async getAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBGetAllRecordsParams<T>,
  ): Promise<ILocalDBGetAllRecordsResult<T>> {
    return this.withTransaction(
      async (tx) => {
        const { records } = await this.txGetAllRecords({ ...params, tx });
        return { records };
      },
      { readOnly: true },
    );
  }

  async getRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordByIdParams<T>,
  ): Promise<ILocalDBGetRecordByIdResult<T>> {
    return this.withTransaction(
      async (tx) => {
        const [record] = await this.txGetRecordById({ ...params, tx });
        return record;
      },
      { readOnly: true },
    );
  }

  async txGetRecordsCount<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordsCountParams<T>,
  ): Promise<ILocalDBGetRecordsCountResult> {
    const { name } = params;
    const objList = this.realm.objects<IRealmDBSchemaMap[T]>(name);
    return Promise.resolve({
      count: objList.length,
    });
  }

  async txGetAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetAllRecordsParams<T>,
  ): Promise<ILocalDBTxGetAllRecordsResult<T>> {
    const { name, ids } = params;
    let objList: Array<{ record: any } | null | undefined> = [];

    if (ids) {
      objList = ids.map((id) => this._getObjectRecordById(name, id));
    } else {
      objList = this.realm.objects<IRealmDBSchemaMap[T]>(name) as any;
    }

    const recordPairs: ILocalDBRecordPair<T>[] = [];
    const records: ILocalDBRecord<T>[] = [];
    objList.forEach((obj) => {
      recordPairs.push([obj ? obj.record : null, obj as any]);
      records.push(obj ? obj.record : null);
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

  checkSchemaPropertiesDefined({
    name,
    record,
  }: {
    name: ELocalDBStoreNames;
    record: any;
  }) {
    if (process.env.NODE_ENV !== 'production') {
      const schemaClass = realmDBSchemasMap[name];
      const propertiesKeys = Object.keys(schemaClass.schema.properties);
      const recordKeys = Object.keys(record || {});
      recordKeys.forEach((key) => {
        if (!propertiesKeys.includes(key)) {
          throw new Error(`Realm schema properties missing: ${name} ${key}`);
        }
      });
    }
  }

  async txAddRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxAddRecordsParams<T>,
  ): Promise<ILocalDBTxAddRecordsResult> {
    const { name, records, skipIfExists } = params;
    checkIsDefined(params.tx);
    checkIsDefined(params.name);

    this.checkSchemaPropertiesDefined({
      name,
      record: records?.[0] || {},
    });

    const result: ILocalDBTxAddRecordsResult = {
      added: 0,
      skipped: 0,
      addedIds: [],
    };
    records.forEach((r) => {
      let shouldAdd = true;
      if (skipIfExists) {
        const existingRecord = this._getObjectRecordById(name, r.id);
        if (existingRecord) {
          shouldAdd = false;
        }
      }
      if (shouldAdd) {
        this.realm.create(name, r as any);
        result.added += 1;
        result.addedIds.push(r.id);
      } else {
        result.skipped += 1;
      }
    });
    return Promise.resolve(result);
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
