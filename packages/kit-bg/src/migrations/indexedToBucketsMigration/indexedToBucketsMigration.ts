import { openDB } from 'idb';

import {
  DB_MAIN_CONTEXT_ID,
  DEFAULT_VERIFY_STRING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import {
  LEGACY_INDEXED_DB_NAME,
  storeNameSupportCreatedAt,
} from '../../dbs/local/consts';
import { ELocalDBStoreNames } from '../../dbs/local/localDBStoreNames';
import { EIndexedDBBucketNames } from '../../dbs/local/types';

import legacyIndexedDb from './legacyIndexedDb';
import {
  migrateAccountBucketRecords,
  migrateRecords,
} from './migrateRecordsFn';

import type { IMigrateRecordsResult } from './types';
import type {
  IDBAccount,
  IDBAddress,
  IDBCloudSyncItem,
  IDBConnectedSite,
  IDBContext,
  IDBCredential,
  IDBDevice,
  IDBIndexedAccount,
  IDBSignedMessage,
  IDBSignedTransaction,
  IDBWallet,
  IIndexedBucketsMap,
  IIndexedDBSchemaMap,
} from '../../dbs/local/types';
import type { IDBPDatabase, IDBPObjectStore, IDBPTransaction } from 'idb';

async function legacyDbExists(): Promise<boolean> {
  try {
    const databases = await globalThis.indexedDB.databases();
    return databases.some((db) => db.name === LEGACY_INDEXED_DB_NAME);
  } catch (error) {
    return false;
  }
}

async function migrateOneKeyV5LegacyDBToBucket({
  buckets,
}: {
  buckets: IIndexedBucketsMap;
}) {
  if (!(await legacyDbExists())) {
    console.log(
      'migrateOneKeyV5LegacyDBToBucket skipped:  legacyDb not exists',
    );
    return;
  }

  // const cloudSyncBucket = buckets[EIndexedDBBucketNames.cloudSync];
  const accountBucket = buckets[EIndexedDBBucketNames.account];
  const backupAccountBucket = buckets[EIndexedDBBucketNames.backupAccount];
  const addressBucket = buckets[EIndexedDBBucketNames.address];
  const archiveBucket = buckets[EIndexedDBBucketNames.archive];

  const accountCount = await accountBucket.count(ELocalDBStoreNames.Account);
  const walletCount = await accountBucket.count(ELocalDBStoreNames.Wallet);
  const deviceCount = await accountBucket.count(ELocalDBStoreNames.Device);
  const credentialCount = await accountBucket.count(
    ELocalDBStoreNames.Credential,
  );
  const contextCount = await accountBucket.count(ELocalDBStoreNames.Context);
  const context = await accountBucket.get(
    ELocalDBStoreNames.Context,
    DB_MAIN_CONTEXT_ID,
  );

  const isBucketDBMigrated =
    deviceCount > 0 ||
    walletCount > 3 ||
    credentialCount > 0 ||
    accountCount > 0 ||
    context?.verifyString !== DEFAULT_VERIFY_STRING;

  if (isBucketDBMigrated) {
    console.log(
      'migrateOneKeyV5LegacyDBToBucket skipped:  bucketDB is migrated already',
    );
    return;
  }

  await legacyIndexedDb.open();

  const legacyContextCount = await legacyIndexedDb.count(
    ELocalDBStoreNames.Context,
  );
  const legacyAccountCount = await legacyIndexedDb.count(
    ELocalDBStoreNames.Account,
  );
  const legacyWalletCount = await legacyIndexedDb.count(
    ELocalDBStoreNames.Wallet,
  );

  const legacyCloudSyncItems: IDBCloudSyncItem[] = await legacyIndexedDb.getAll(
    ELocalDBStoreNames.CloudSyncItem,
  );
  const legacyAccounts: IDBAccount[] = await legacyIndexedDb.getAll(
    ELocalDBStoreNames.Account,
  );
  const legacyCredentials: IDBCredential[] = await legacyIndexedDb.getAll(
    ELocalDBStoreNames.Credential,
  );
  const legacyDevices: IDBDevice[] = await legacyIndexedDb.getAll(
    ELocalDBStoreNames.Device,
  );
  const legacyWallets: IDBWallet[] = await legacyIndexedDb.getAll(
    ELocalDBStoreNames.Wallet,
  );
  const legacyIndexedAccounts: IDBIndexedAccount[] =
    await legacyIndexedDb.getAll(ELocalDBStoreNames.IndexedAccount);
  const legacyContexts: IDBContext[] = await legacyIndexedDb.getAll(
    ELocalDBStoreNames.Context,
  );
  const legacyAddresses: IDBAddress[] = await legacyIndexedDb.getAll(
    ELocalDBStoreNames.Address,
  );
  const legacySignedMessages: IDBSignedMessage[] = await legacyIndexedDb.getAll(
    ELocalDBStoreNames.SignedMessage,
  );
  const legacySignedTransactions: IDBSignedTransaction[] =
    await legacyIndexedDb.getAll(ELocalDBStoreNames.SignedTransaction);
  const legacyConnectedSites: IDBConnectedSite[] = await legacyIndexedDb.getAll(
    ELocalDBStoreNames.ConnectedSite,
  );

  await timerUtils.wait(1000);

  const migrateResults: IMigrateRecordsResult[] = [];

  // #region migrate account bucket
  const objectStoreNames: ELocalDBStoreNames[] = [
    ELocalDBStoreNames.CloudSyncItem,
    ELocalDBStoreNames.Context,
    ELocalDBStoreNames.Credential,
    ELocalDBStoreNames.Device,
    ELocalDBStoreNames.Wallet,
    ELocalDBStoreNames.IndexedAccount,
    ELocalDBStoreNames.Account,
  ];
  const updateRecords = {
    cloudSyncItem: legacyCloudSyncItems,
    context: legacyContexts,
    credential: legacyCredentials,
    device: legacyDevices,
    wallet: legacyWallets,
    indexedAccount: legacyIndexedAccounts,
    account: legacyAccounts,
  };
  const accountBucketTx = accountBucket.transaction(
    objectStoreNames,
    'readwrite',
  );
  migrateResults.push(
    ...(await migrateAccountBucketRecords({
      tx: accountBucketTx,
      records: updateRecords,
    })),
  );

  const backupAccountBucketTx = backupAccountBucket.transaction(
    objectStoreNames,
    'readwrite',
  );
  migrateResults.push(
    ...(await migrateAccountBucketRecords({
      tx: backupAccountBucketTx,
      records: updateRecords,
    })),
  );
  // #endregion

  // #region migrate address bucket
  const addressBucketTx = addressBucket.transaction(
    [ELocalDBStoreNames.Address],
    'readwrite',
  );
  migrateResults.push(
    await migrateRecords({
      tx: addressBucketTx,
      name: ELocalDBStoreNames.Address,
      records: legacyAddresses,
    }),
  );
  // #endregion

  // #region migrate archive bucket
  const archiveBucketTx = archiveBucket.transaction(
    [
      ELocalDBStoreNames.SignedMessage,
      ELocalDBStoreNames.SignedTransaction,
      ELocalDBStoreNames.ConnectedSite,
    ],
    'readwrite',
  );
  migrateResults.push(
    await migrateRecords({
      tx: archiveBucketTx,
      name: ELocalDBStoreNames.SignedMessage,
      records: legacySignedMessages,
    }),
  );
  migrateResults.push(
    await migrateRecords({
      tx: archiveBucketTx,
      name: ELocalDBStoreNames.SignedTransaction,
      records: legacySignedTransactions,
    }),
  );
  migrateResults.push(
    await migrateRecords({
      tx: archiveBucketTx,
      name: ELocalDBStoreNames.ConnectedSite,
      records: legacyConnectedSites,
    }),
  );
  // #endregion

  // #region migrate cloud sync bucket
  // const cloudSyncBucketTx = cloudSyncBucket.transaction(
  //   [ELocalDBStoreNames.CloudSyncItem],
  //   'readwrite',
  // );
  // migrateResults.push(
  //   await migrateRecords({
  //     tx: cloudSyncBucketTx,
  //     name: ELocalDBStoreNames.CloudSyncItem,
  //     records: legacyCloudSyncItems,
  //   }),
  // );
  // #endregion

  // TODO atom is init before localDB
  console.log('migrateOneKeyV5LegacyDBToBucket result', {
    _migrateResults: migrateResults,

    accountCount,
    walletCount,
    contextCount,
    context,

    _legacy: {
      legacyAccounts,
      legacyContextCount,
      legacyAccountCount,
      legacyWalletCount,
    },
  });

  await timerUtils.wait(1 * 1000);

  return true;
}

async function migrateBackupDBToBucket() {
  // TODO
  // const backupBucket = await openDB(BACKUP_INDEXED_DB_NAME);
}

export default {
  migrateOneKeyV5LegacyDBToBucket,
  migrateBackupDBToBucket,
  migrateAccountBucketRecords,
};
