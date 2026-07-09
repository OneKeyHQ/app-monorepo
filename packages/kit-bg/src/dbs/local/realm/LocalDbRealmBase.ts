// eslint-disable-next-line max-classes-per-file
import Realm from 'realm';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import {
  DB_MAIN_CONTEXT_ID,
  DEFAULT_VERIFY_STRING,
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { LocalDbOpenError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ensureLocalDbNotOnNativeMainThread } from '@onekeyhq/shared/src/utils/assertUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { localDbOpenErrorAtom } from '../../../states/jotai/atoms/localDb';
import { REALM_DB_NAME, REALM_DB_VERSION } from '../consts';
import { LocalDbBase } from '../LocalDbBase';
import { ELocalDBStoreNames } from '../localDBStoreNames';
import { EIndexedDBBucketNames, type IDBWalletIdSingleton } from '../types';

import { RealmDBAgent } from './RealmDBAgent';
import { realmDBSchemas } from './schemas';

export abstract class LocalDbRealmBase extends LocalDbBase {
  override readyDb: Promise<RealmDBAgent>;

  constructor() {
    super();
    this.readyDb = this._openDb();
  }

  // ---------------------------------------------- private methods
  private async _openDb() {
    // Explicit runtime fence: in a two-runtime native build, Realm must only be
    // opened on the background runtime. This turns the previously implicit
    // "main thread never opens Realm" convention into an enforced guard so a
    // future refactor cannot accidentally open the DB on the UI/main thread.
    ensureLocalDbNotOnNativeMainThread();
    let realm: Realm;
    try {
      realm = await Realm.open({
        path: REALM_DB_NAME,
        schema: realmDBSchemas as any,
        schemaVersion: REALM_DB_VERSION,
        onMigration: (oldRealm: Realm, newRealm: Realm) => {
          const oldVersion = oldRealm.schemaVersion;
          const newVersion = newRealm.schemaVersion;
          console.log(oldVersion, newVersion);
          // do nothing here, add migration logic on service layer

          // update network rpcURL
          if (oldRealm.schemaVersion < 13) {
            //   const networks = newRealm.objects<NetworkSchema>('Network');
            //   for (const network of networks) {
            //     const toClear = DEFAULT_RPC_ENDPOINT_TO_CLEAR[network.id];
            //     if (typeof toClear !== 'undefined' && network.rpcURL === toClear) {
            //       network.rpcURL = '';
            //     }
            //   }
          }
        },
      });
    } catch (error) {
      // Any failure to open the local database is re-thrown as a generic
      // LocalDbOpenError. A version downgrade (on-disk DB newer than this build)
      // is only one possible cause — disk corruption, I/O errors, locking, etc.
      // all land here too — so we deliberately do NOT inspect the error
      // type/message to classify it (brittle and easy to misclassify). We keep
      // the ORIGINAL error message (only falling back to a fixed English string
      // when the underlying error carries none): record it via the structured
      // logger (console.* is stripped in production; defaultLogger reaches the
      // exportable logs the user can upload from the lock screen), publish it to
      // the global atom so the lock screen can show it immediately on mount, and
      // carry it on the thrown error so the raw reason is never masked.
      // (OK-56874)
      const rawMessage = (error as Error)?.message || 'DB open unknown error';
      defaultLogger.app.error.log(`[LocalDbRealm] open failed: ${rawMessage}`);
      void localDbOpenErrorAtom.set({ errorMessage: rawMessage });
      throw new LocalDbOpenError({ message: rawMessage });
    }
    if (process.env.NODE_ENV !== 'production') {
      appGlobals.$$realm = realm;
      setTimeout(() => {
        appEventBus.emit(EAppEventBusNames.RealmInit, undefined);
      }, 3000);
    }
    const db = new RealmDBAgent(realm);
    // init db records here
    await this._initDBRecords(db);
    return db;
  }

  private async _initDBRecords(db: RealmDBAgent) {
    await db.withTransaction(EIndexedDBBucketNames.account, async () => {
      db._getOrAddObjectRecord(ELocalDBStoreNames.Context, {
        id: DB_MAIN_CONTEXT_ID,
        nextHD: 1,
        nextWalletNo: 1,
        verifyString: DEFAULT_VERIFY_STRING,
        localSecretEnvelopeCredentialMigrated: false,
        localSecretEnvelopeCredentialMigratedTargetVersion: 0,
        localSecretEnvelopeCredentialMigrationLastScannedCredentialId: '',
        backupUUID: generateUUID(),
        nextSignatureMessageId: 1,
        nextSignatureTransactionId: 1,
        nextConnectedSiteId: 1,
      });
      this._addSingletonWalletRecord({
        db,
        walletId: WALLET_TYPE_IMPORTED,
      });
      this._addSingletonWalletRecord({
        db,
        walletId: WALLET_TYPE_WATCHING,
      });
      this._addSingletonWalletRecord({
        db,
        walletId: WALLET_TYPE_EXTERNAL,
      });
    });
  }

  private _addSingletonWalletRecord({
    db,
    walletId,
  }: {
    db: RealmDBAgent;
    walletId: IDBWalletIdSingleton;
  }) {
    db._getOrAddObjectRecord(
      ELocalDBStoreNames.Wallet,
      this.buildSingletonWalletRecord({ walletId }),
    );
  }

  async deleteDb() {
    try {
      const db = await this.readyDb;
      db.realm.close();
      Realm.deleteFile({ path: REALM_DB_NAME });
    } catch (error: any) {
      console.error(error);
      return Promise.reject(error);
    }
  }
}
