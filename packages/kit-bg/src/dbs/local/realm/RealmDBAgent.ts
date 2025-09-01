import { Semaphore, withTimeout } from 'async-mutex';
import { isNumber } from 'lodash';
import Realm from 'realm';

import {
  LocalDBRecordNotFoundError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { storeNameSupportCreatedAt } from '../consts';
import indexedUtils from '../indexed/indexedDBUtils';
import { LocalDbAgentBase } from '../LocalDbAgentBase';

import { realmDBSchemasMap } from './schemas';

import type { RealmObjectBase } from './base/RealmObjectBase';
import type { ELocalDBStoreNames } from '../localDBStoreNames';
import type {
  EIndexedDBBucketNames,
  ILocalDBAgent,
  ILocalDBGetAllRecordsParams,
  ILocalDBGetAllRecordsResult,
  ILocalDBGetRecordByIdParams,
  ILocalDBGetRecordByIdResult,
  ILocalDBGetRecordIdsParams,
  ILocalDBGetRecordIdsResult,
  ILocalDBGetRecordsByIdsParams,
  ILocalDBGetRecordsByIdsResult,
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
  ILocalDBTxGetRecordIdsParams,
  ILocalDBTxGetRecordIdsResult,
  ILocalDBTxGetRecordsByIdsParams,
  ILocalDBTxGetRecordsByIdsResult,
  ILocalDBTxGetRecordsCountParams,
  ILocalDBTxRemoveRecordsParams,
  ILocalDBTxUpdateRecordsParams,
  ILocalDBWithTransactionOptions,
  ILocalDBWithTransactionTask,
  IRealmDBSchemaMap,
} from '../types';

export class RealmDBAgent extends LocalDbAgentBase implements ILocalDBAgent {
  constructor(realm: Realm) {
    super();
    this.realm = realm;
  }

  async clearRecords({ name }: { name: ELocalDBStoreNames }): Promise<void> {
    const bucketName = indexedUtils.getBucketNameByStoreName(name);
    await this.withTransaction(bucketName, async (tx) => {
      const { recordPairs } = await this.txGetAllRecords({ name, tx });
      await this.txRemoveRecords({
        tx,
        name,
        recordPairs: recordPairs.filter(Boolean),
      });
    });
  }

  realm: Realm;

  _getObjectRecordById<T extends ELocalDBStoreNames>(
    storeName: T,
    recordId: string,
  ) {
    checkIsDefined(storeName);
    // console.log('realmdb _getObjectRecordById ', { storeName, recordId });
    const object = this.realm.objectForPrimaryKey<IRealmDBSchemaMap[T]>(
      storeName,
      recordId as any,
    );
    // console.log('realmdb _getObjectRecordById ', object);
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
  withTransactionMutex = withTimeout(
    new Semaphore(1),
    // Error: timeout while waiting for mutex to become available
    timerUtils.getTimeDurationMs({
      seconds: 30, // lock timeout
    }),
    // 1,
  );

  async withTransaction<T>(
    bucketName: EIndexedDBBucketNames,
    task: ILocalDBWithTransactionTask<T>,
    options?: ILocalDBWithTransactionOptions,
  ): Promise<T> {
    const shouldUseTransaction = !options?.readOnly;
    const fn = async () => {
      // Error: The Realm is already in a write transaction
      if (shouldUseTransaction) {
        this.realm.beginTransaction();
      }
      try {
        const tx = {
          bucketName,
        };
        const result = await task(tx);
        // await timerUtils.wait(2000);
        if (shouldUseTransaction) {
          this.realm.commitTransaction();
        }
        return result;
      } catch (error) {
        if (shouldUseTransaction) {
          // transaction.abort()
          this.realm.cancelTransaction();
        }
        throw error;
      }
    };
    if (options?.readOnly) {
      return fn();
    }

    // write operation should use mutex lock
    return this.withTransactionMutex.runExclusive(fn);
  }

  async getRecordsCount<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordsCountParams<T>,
  ): Promise<ILocalDBGetRecordsCountResult> {
    const bucketName = indexedUtils.getBucketNameByStoreName(params.name);
    return this.withTransaction(
      bucketName,
      async (tx) => {
        const { count } = await this.txGetRecordsCount({ ...params, tx });
        return { count };
      },
      { readOnly: true },
    );
  }

  async getRecordsByIds<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordsByIdsParams<T>,
  ): Promise<ILocalDBGetRecordsByIdsResult<T>> {
    const bucketName = indexedUtils.getBucketNameByStoreName(params.name);
    return this.withTransaction(
      bucketName,
      async (tx) => {
        const { records } = await this.txGetRecordsByIds({ ...params, tx });
        return { records };
      },
      { readOnly: true },
    );
  }

  async getRecordIds<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordIdsParams<T>,
  ): Promise<ILocalDBGetRecordIdsResult> {
    const bucketName = indexedUtils.getBucketNameByStoreName(params.name);
    return this.withTransaction(bucketName, async (tx) => {
      const ids = await this.txGetRecordIds({ ...params, tx });
      return ids;
    });
  }

  async getAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBGetAllRecordsParams<T>,
  ): Promise<ILocalDBGetAllRecordsResult<T>> {
    const bucketName = indexedUtils.getBucketNameByStoreName(params.name);
    return this.withTransaction(
      bucketName,
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
    const bucketName = indexedUtils.getBucketNameByStoreName(params.name);
    return this.withTransaction(
      bucketName,
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

  async txGetRecordsByIds<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordsByIdsParams<T>,
  ): Promise<ILocalDBTxGetRecordsByIdsResult<T>> {
    const { name, ids } = params;
    let objList: Array<{ record: any } | null | undefined> = [];
    objList = ids.map((id) => this._getObjectRecordById(name, id)) as any;

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

  async txGetRecordIds<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordIdsParams<T>,
  ): Promise<ILocalDBTxGetRecordIdsResult> {
    const { name } = params;
    const objList = this.realm.objects<IRealmDBSchemaMap[T]>(name);
    const length = objList.length;

    const ids = new Array<string>(length);
    for (let i = 0; i < length; i += 1) {
      ids[i] = objList[i].id;
    }
    return Promise.resolve(ids);
  }

  async txGetAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetAllRecordsParams<T>,
  ): Promise<ILocalDBTxGetAllRecordsResult<T>> {
    const { name, limit, offset } = params;
    let objList: Array<{ record: any } | null | undefined> = [];

    const isSlice = isNumber(limit) && isNumber(offset);
    const hasCreatedAtIndex = storeNameSupportCreatedAt.includes(name);
    let items = this.realm.objects<IRealmDBSchemaMap[T]>(name);
    if (isSlice && hasCreatedAtIndex) {
      items = items
        .sorted('createdAt', true)
        .slice(offset, offset + limit) as any;
    }
    objList = items as any;

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
    // @ts-ignore
    const record = obj?.record;
    if (!record) {
      throw new LocalDBRecordNotFoundError(`record not found: ${name} ${id}`);
    }
    // eslint-disable-next-line
    return [record as any, obj];
  }

  async txUpdateRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxUpdateRecordsParams<T>,
  ): Promise<void> {
    const { tx, updater } = params;
    checkIsDefined(tx);
    resetUtils.checkNotInResetting();

    const pairs = await this.buildRecordPairsFromIds(params);

    await Promise.all(
      pairs.map(async (oldRecord) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const newRecord = await updater(oldRecord[1]!);
        if (newRecord instanceof Realm.Object) {
          return newRecord;
        }
        throw new OneKeyLocalError('newRecord is not a Relam.Object');
      }),
    );
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
          throw new OneKeyLocalError(
            `Realm schema properties missing: ${name} ${key}`,
          );
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
    resetUtils.checkNotInResetting();
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
    resetUtils.checkNotInResetting();
    const pairs = await this.buildRecordPairsFromIds(params);

    this.realm.delete(pairs.map((pair) => pair[1]));
    return Promise.resolve(undefined);
  }
}
