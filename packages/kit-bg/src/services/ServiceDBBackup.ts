import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { ELocalDBStoreNames } from '../dbs/local/localDBStoreNames';
import { EIndexedDBBucketNames } from '../dbs/local/types';
import { migrateAccountBucketRecords } from '../migrations/indexedToBucketsMigration/migrateRecordsFn';

import ServiceBase from './ServiceBase';

import type { IndexedDBAgent } from '../dbs/local/indexed/IndexedDBAgent';
import type {
  IDBAccount,
  IDBCloudSyncItem,
  IDBContext,
  IDBCredential,
  IDBDevice,
  IDBIndexedAccount,
  IDBWallet,
} from '../dbs/local/types';
import type { ISimpleDBAppStatus } from '../dbs/simple/entity/SimpleDbEntityAppStatus';

@backgroundClass()
class ServiceDBBackup extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  // TODO backup to extensionStorage
  @backgroundMethod()
  async backupDatabaseDaily(): Promise<void> {
    if (!platformEnv.isRuntimeBrowser) {
      return;
    }

    const appStatus = await this.backgroundApi.simpleDb.appStatus.getRawData();
    if (
      appStatus?.lastDBBackupTime &&
      Date.now() - appStatus.lastDBBackupTime <
        timerUtils.getTimeDurationMs({
          hour: 24,
        })
    ) {
      return;
    }

    try {
      const nativeDb = (await this.backgroundApi.localDb
        .readyDb) as IndexedDBAgent;

      const db = nativeDb.getIndexedByBucketName(EIndexedDBBucketNames.account);

      const backupDB = nativeDb.getIndexedByBucketName(
        EIndexedDBBucketNames.backupAccount,
      );

      const cloudSyncItems: IDBCloudSyncItem[] = await db.getAll(
        ELocalDBStoreNames.CloudSyncItem,
      );

      const accounts: IDBAccount[] = await db.getAll(
        ELocalDBStoreNames.Account,
      );

      const credentials: IDBCredential[] = await db.getAll(
        ELocalDBStoreNames.Credential,
      );

      const devices: IDBDevice[] = await db.getAll(ELocalDBStoreNames.Device);

      const wallets: IDBWallet[] = await db.getAll(ELocalDBStoreNames.Wallet);

      const indexedAccounts: IDBIndexedAccount[] = await db.getAll(
        ELocalDBStoreNames.IndexedAccount,
      );

      const contexts: IDBContext[] = await db.getAll(
        ELocalDBStoreNames.Context,
      );

      const backupTx = backupDB.transaction(
        [
          ELocalDBStoreNames.Account,
          ELocalDBStoreNames.CloudSyncItem,
          ELocalDBStoreNames.Context,
          ELocalDBStoreNames.Credential,
          ELocalDBStoreNames.Device,
          ELocalDBStoreNames.IndexedAccount,
          ELocalDBStoreNames.Wallet,
        ],
        'readwrite',
      );

      await migrateAccountBucketRecords({
        tx: backupTx,
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
    } catch (error) {
      // TODO log error
      console.error('ServiceDBBackup backupDatabase error', error);
    } finally {
      await this.backgroundApi.simpleDb.appStatus.setRawData(
        (prev): ISimpleDBAppStatus => ({
          ...prev,
          lastDBBackupTime: Date.now(),
        }),
      );
    }
  }
}

export default ServiceDBBackup;
