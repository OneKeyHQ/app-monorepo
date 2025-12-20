import {
  DB_MAIN_CONTEXT_ID,
  DEFAULT_VERIFY_STRING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import type { IndexedDBPromised } from '@onekeyhq/shared/src/IndexedDBPromised';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import {
  INDEXED_DB_BUCKET_PRESET_STORE_NAMES,
  LEGACY_INDEXED_DB_NAME,
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

async function legacyDbExists(): Promise<boolean> {
  try {
    const databases = await globalThis.indexedDB.databases();
    return databases.some((db) => db.name === LEGACY_INDEXED_DB_NAME);
  } catch (error) {
    return false;
  }
}

export type ICheckCurrentDBIsMigratedToBucketResult = {
  isMigrated: boolean;

  buckets: IIndexedBucketsMap;

  accountBucket: IndexedDBPromised<IIndexedDBSchemaMap>;
  backupAccountBucket: IndexedDBPromised<IIndexedDBSchemaMap>;
  addressBucket: IndexedDBPromised<IIndexedDBSchemaMap>;
  archiveBucket: IndexedDBPromised<IIndexedDBSchemaMap>;

  accountCount: number;
  walletCount: number;
  contextCount: number;
  context: IDBContext | undefined;
};

async function checkCurrentDBIsMigrated({
  buckets,
}: {
  buckets: IIndexedBucketsMap;
}): Promise<ICheckCurrentDBIsMigratedToBucketResult> {
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
    context?.verifyString !== DEFAULT_VERIFY_STRING ||
    Boolean(context?.nextHD && context?.nextHD > 1) ||
    Boolean(context?.nextWalletNo && context?.nextWalletNo > 1);

  return {
    isMigrated: isBucketDBMigrated,
    buckets,
    accountBucket,
    backupAccountBucket,
    addressBucket,
    archiveBucket,
    accountCount,
    walletCount,
    contextCount,
    context,
  };
}

async function migrateBackupedDataToBucket({
  isMigrated,
  accountBucket,
  backupAccountBucket,
}: ICheckCurrentDBIsMigratedToBucketResult) {
  if (isMigrated) {
    console.log(
      'migrateBackupedDataToBucket skipped:  bucketDB is migrated already',
    );
    return;
  }

  const backupDB = backupAccountBucket;

  const cloudSyncItems: IDBCloudSyncItem[] = await backupDB.getAll(
    ELocalDBStoreNames.CloudSyncItem,
  );

  const accounts: IDBAccount[] = await backupDB.getAll(
    ELocalDBStoreNames.Account,
  );

  const credentials: IDBCredential[] = await backupDB.getAll(
    ELocalDBStoreNames.Credential,
  );

  const devices: IDBDevice[] = await backupDB.getAll(ELocalDBStoreNames.Device);

  const wallets: IDBWallet[] = await backupDB.getAll(ELocalDBStoreNames.Wallet);

  const indexedAccounts: IDBIndexedAccount[] = await backupDB.getAll(
    ELocalDBStoreNames.IndexedAccount,
  );

  const contexts: IDBContext[] = await backupDB.getAll(
    ELocalDBStoreNames.Context,
  );

  await timerUtils.wait(1000);

  const tx = accountBucket.transaction(
    INDEXED_DB_BUCKET_PRESET_STORE_NAMES[EIndexedDBBucketNames.account],
    'readwrite',
  );

  await migrateAccountBucketRecords({
    tx,
    records: {
      cloudSyncItem: cloudSyncItems,
      context: contexts,
      credential: credentials,
      device: devices,
      indexedAccount: indexedAccounts,
      wallet: wallets,
      account: accounts,
    },
  });

  await timerUtils.wait(1000);
}

async function migrateOneKeyV5LegacyDBToBucket({
  isMigrated,
  accountBucket,
  addressBucket,
  archiveBucket,
  accountCount,
  walletCount,
  contextCount,
  context,
}: ICheckCurrentDBIsMigratedToBucketResult) {
  if (isMigrated) {
    console.log(
      'migrateOneKeyV5LegacyDBToBucket skipped:  bucketDB is migrated already',
    );
    return;
  }

  if (!(await legacyDbExists())) {
    console.log(
      'migrateOneKeyV5LegacyDBToBucket skipped:  legacyDb not exists',
    );
    return;
  }

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
  const objectStoreNames: ELocalDBStoreNames[] =
    INDEXED_DB_BUCKET_PRESET_STORE_NAMES[EIndexedDBBucketNames.account];

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

  // Do not update backup data from legacy database, it will overwrite the backup data
  // const backupAccountBucketTx = backupAccountBucket.transaction(
  //   objectStoreNames,
  //   'readwrite',
  // );
  // migrateResults.push(
  //   ...(await migrateAccountBucketRecords({
  //     tx: backupAccountBucketTx,
  //     records: updateRecords,
  //   })),
  // );

  // #endregion

  // #region migrate address bucket
  const addressBucketTx = addressBucket.transaction(
    INDEXED_DB_BUCKET_PRESET_STORE_NAMES[EIndexedDBBucketNames.address],
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
    INDEXED_DB_BUCKET_PRESET_STORE_NAMES[EIndexedDBBucketNames.archive],
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

  await timerUtils.wait(1000);

  return true;
}

export default {
  checkCurrentDBIsMigrated,
  migrateOneKeyV5LegacyDBToBucket,
  migrateBackupedDataToBucket,
  migrateAccountBucketRecords,
};
