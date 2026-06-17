import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { type IInstanceMetaBackup } from '@onekeyhq/shared/types/desktop';

import { INDEXED_DB_BUCKET_PRESET_STORE_NAMES } from '../../dbs/local/consts';
import { ELocalDBStoreNames } from '../../dbs/local/localDBStoreNames';
import { EIndexedDBBucketNames } from '../../dbs/local/types';
import legacyIndexedDb from '../../migrations/indexedToBucketsMigration/legacyIndexedDb';
import { migrateAccountBucketRecords } from '../../migrations/indexedToBucketsMigration/migrateRecordsFn';
import { passwordAtom, settingsPersistAtom } from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';

import dbBackupTools from './dbBackupTools';

import type { IndexedDBAgent } from '../../dbs/local/indexed/IndexedDBAgent';
import type {
  IDBAccount,
  IDBCloudSyncItem,
  IDBContext,
  IDBCredential,
  IDBDevice,
  IDBIndexedAccount,
  IDBWallet,
} from '../../dbs/local/types';
import type { ISimpleDBAppStatus } from '../../dbs/simple/entity/SimpleDbEntityAppStatus';

@backgroundClass()
class ServiceDBBackup extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  canBackup() {
    return Boolean(
      platformEnv.isExtension || platformEnv.isDesktop || platformEnv.isWeb,
    );
  }

  @backgroundMethod()
  async removeBackupHDWallet({ walletId }: { walletId: string }) {
    if (!this.canBackup()) {
      return;
    }
    const isHdWallet = accountUtils.isHdWallet({ walletId });
    if (!isHdWallet) {
      return;
    }
    try {
      const nativeDb = (await this.backgroundApi.localDb
        .readyDb) as IndexedDBAgent;
      const backupDB = nativeDb.getIndexedByBucketName(
        EIndexedDBBucketNames.backupAccount,
      );

      const createBackupTx = () => {
        return backupDB.transaction(
          INDEXED_DB_BUCKET_PRESET_STORE_NAMES[EIndexedDBBucketNames.account],
          'readwrite',
        );
      };

      try {
        const backupTx = createBackupTx();
        await backupTx.objectStore(ELocalDBStoreNames.Wallet)?.delete(walletId);
      } catch (error) {
        console.error('ServiceDBBackup removeBackupHDWallet error', error);
      }

      try {
        const backupTx = createBackupTx();
        await backupTx
          .objectStore(ELocalDBStoreNames.Credential)
          ?.delete(walletId);
      } catch (error) {
        console.error('ServiceDBBackup removeBackupHDWallet error', error);
      }
    } catch (error) {
      console.error('ServiceDBBackup removeBackupHDWallet error', error);
    }

    try {
      await legacyIndexedDb.delete(ELocalDBStoreNames.Wallet, walletId);
    } catch (error) {
      console.error('ServiceDBBackup removeBackupHDWallet error', error);
    }

    try {
      await legacyIndexedDb.delete(ELocalDBStoreNames.Credential, walletId);
    } catch (error) {
      console.error('ServiceDBBackup removeBackupHDWallet error', error);
    }
  }

  @backgroundMethod()
  async removeBackupImportedAccount({ accountId }: { accountId: string }) {
    if (!this.canBackup()) {
      return;
    }
    const isImportedAccount = accountUtils.isImportedAccount({ accountId });
    if (!isImportedAccount) {
      return;
    }
    try {
      const nativeDb = (await this.backgroundApi.localDb
        .readyDb) as IndexedDBAgent;
      const backupDB = nativeDb.getIndexedByBucketName(
        EIndexedDBBucketNames.backupAccount,
      );

      const createBackupTx = () => {
        return backupDB.transaction(
          INDEXED_DB_BUCKET_PRESET_STORE_NAMES[EIndexedDBBucketNames.account],
          'readwrite',
        );
      };

      try {
        const backupTx = createBackupTx();
        await backupTx
          .objectStore(ELocalDBStoreNames.Account)
          ?.delete(accountId);
      } catch (error) {
        console.error(
          'ServiceDBBackup removeBackupImportedAccount error',
          error,
        );
      }

      try {
        const backupTx = createBackupTx();
        await backupTx
          .objectStore(ELocalDBStoreNames.Credential)
          ?.delete(accountId);
      } catch (error) {
        console.error(
          'ServiceDBBackup removeBackupImportedAccount error',
          error,
        );
      }
    } catch (error) {
      console.error('ServiceDBBackup removeBackupImportedAccount error', error);
    }

    try {
      await legacyIndexedDb.delete(ELocalDBStoreNames.Account, accountId);
    } catch (error) {
      console.error('ServiceDBBackup removeBackupImportedAccount error', error);
    }

    try {
      await legacyIndexedDb.delete(ELocalDBStoreNames.Credential, accountId);
    } catch (error) {
      console.error('ServiceDBBackup removeBackupImportedAccount error', error);
    }
  }

  _backupDatabaseDailyPromise: Promise<void> | undefined;

  @backgroundMethod()
  async backupDatabaseDaily(): Promise<void> {
    // Concurrency guard. The daily backup can be triggered concurrently from two
    // places — the Home daily hook (NotificationRegisterDaily) and the
    // pre-migration step in LocalDbBase.runPostPasswordVerifiedLazyUpgrade — so
    // share a single in-flight run to avoid double-writing the backup bucket.
    if (this._backupDatabaseDailyPromise) {
      return this._backupDatabaseDailyPromise;
    }
    this._backupDatabaseDailyPromise = (async () => {
      try {
        await this._backupDatabaseDaily();
      } finally {
        this._backupDatabaseDailyPromise = undefined;
      }
    })();
    return this._backupDatabaseDailyPromise;
  }

  async _backupDatabaseDaily(): Promise<void> {
    if (!this.canBackup()) {
      return;
    }

    // Data-safety gate. The daily backup overwrites the previous backup bucket
    // in place (migrateRecords uses put-by-id, see migrateRecordsFn.ts), so
    // snapshotting a primary DB that the user cannot decrypt would replace the
    // last good backup with unrecoverable data. Require ALL of:
    //   1. the app is unlocked (the unlock flow completed successfully), and
    //   2. a password is held in memory.
    // If the user cannot unlock (e.g. a corrupt master credential), unLock stays
    // false / no password is cached, so we skip the backup and preserve the
    // previous good backup instead of overwriting it. The LSE migration runs
    // this backup once BEFORE it mutates credentials (see
    // LocalDbBase.runPostPasswordVerifiedLazyUpgrade) so a pre-LSE snapshot
    // survives as a recovery net if the LSE upgrade is faulty; we never force a
    // backup AFTER migration, which would overwrite that net. Each early return
    // skips WITHOUT touching lastDBBackupTime, so a skipped attempt does not
    // consume the 24h window and will be retried.
    const { unLock } = await passwordAtom.get();
    if (!unLock) {
      return;
    }
    const hasCachedPassword =
      await this.backgroundApi.servicePassword.hasCachedPassword();
    if (!hasCachedPassword) {
      return;
    }

    // At most once per 24h: the daily trigger fires on every Home focus, so this
    // throttles repeated full backups (performance).
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

    // backup instance meta
    try {
      const settings = await settingsPersistAtom.get();
      const instanceMeta: IInstanceMetaBackup = {
        instanceId: settings.instanceId,
        sensitiveEncodeKey: settings.sensitiveEncodeKey,
        instanceIdBackup: settings.instanceIdBackup,
      };

      await dbBackupTools.backupInstanceMeta(instanceMeta);
    } catch (error) {
      console.error('ServiceDBBackup backup instance meta error', error);
    }

    // backup accounts db
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
        INDEXED_DB_BUCKET_PRESET_STORE_NAMES[EIndexedDBBucketNames.account],
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
