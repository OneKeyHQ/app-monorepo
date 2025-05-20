import type { IndexedDBTransactionPromised } from '@onekeyhq/shared/src/IndexedDBPromised';

import { ELocalDBStoreNames } from '../../dbs/local/localDBStoreNames';

import type { IMigrateRecordsResult } from './types';
import type {
  IDBAccount,
  IDBCloudSyncItem,
  IDBContext,
  IDBCredential,
  IDBDevice,
  IDBIndexedAccount,
  IDBWallet,
  IIndexedDBSchemaMap,
} from '../../dbs/local/types';
import type { IDBPTransaction } from 'idb';

// TODO try catch, return error and if count matched
export async function migrateRecords<T extends { id: string }>({
  records,
  tx,
  name,
}: {
  records: T[];
  tx: IDBPTransaction<IIndexedDBSchemaMap, ELocalDBStoreNames[], 'readwrite'>;
  name: ELocalDBStoreNames;
}): Promise<IMigrateRecordsResult> {
  const store = tx.objectStore(name);
  const dbName = (tx as unknown as IndexedDBTransactionPromised)?.nativeTx?.db
    ?.name;
  await Promise.all(
    records.map(async (record) => {
      const addRecord = async () => {
        try {
          if (store && store.add) {
            await store?.add(record as unknown as any);
          }
        } catch (error) {
          console.error('migrateRecords add error', error);
        }
      };
      // const existingRecord = await store.get(record.id);
      const existingRecord = true;
      if (existingRecord) {
        try {
          if (store && store.put) {
            await store?.put(record as unknown as any);
          }
        } catch (error2) {
          console.error('migrateRecords put error', error2);
          await addRecord();
        }
      } else {
        await addRecord();
      }
      return null;
    }),
  );
  const storeCount = await store.count();
  const recordsCount = records.length;
  return {
    dbName,
    name,
    recordsCount,
    storeCount,
    flag: recordsCount === storeCount ? '✅' : '❌',
  };
}

export async function migrateAccountBucketRecords({
  tx,
  records,
}: {
  tx: IDBPTransaction<IIndexedDBSchemaMap, ELocalDBStoreNames[], 'readwrite'>;
  records: {
    cloudSyncItem: IDBCloudSyncItem[];
    context: IDBContext[];
    credential: IDBCredential[];
    device: IDBDevice[];
    wallet: IDBWallet[];
    indexedAccount: IDBIndexedAccount[];
    account: IDBAccount[];
  };
}) {
  const {
    cloudSyncItem,
    context,
    account,
    credential,
    device,
    indexedAccount,
    wallet,
  } = records;
  const migrateResults: IMigrateRecordsResult[] = [];

  migrateResults.push(
    await migrateRecords({
      tx,
      name: ELocalDBStoreNames.CloudSyncItem,
      records: cloudSyncItem,
    }),
  );

  migrateResults.push(
    await migrateRecords({
      tx,
      name: ELocalDBStoreNames.Context,
      records: context,
    }),
  );
  migrateResults.push(
    await migrateRecords({
      tx,
      name: ELocalDBStoreNames.Credential,
      records: credential,
    }),
  );

  migrateResults.push(
    await migrateRecords({
      tx,
      name: ELocalDBStoreNames.Device,
      records: device,
    }),
  );
  migrateResults.push(
    await migrateRecords({
      tx,
      name: ELocalDBStoreNames.Wallet,
      records: wallet,
    }),
  );
  migrateResults.push(
    await migrateRecords({
      tx,
      name: ELocalDBStoreNames.IndexedAccount,
      records: indexedAccount,
    }),
  );

  migrateResults.push(
    await migrateRecords({
      tx,
      name: ELocalDBStoreNames.Account,
      records: account,
    }),
  );

  return migrateResults;
}
