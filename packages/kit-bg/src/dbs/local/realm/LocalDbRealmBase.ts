// eslint-disable-next-line max-classes-per-file
import Realm from 'realm';

import {
  DB_MAIN_CONTEXT_ID,
  DEFAULT_VERIFY_STRING,
  REALM_DB_NAME,
  REALM_DB_VERSION,
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { LocalDbBase } from '../LocalDbBase';
import { ELocalDBStoreNames } from '../localDBStoreNames';

import { RealmDBAgent } from './RealmDBAgent';
import { realmDBSchemas } from './schemas';

import type { IDBWalletIdSingleton } from '../types';

export abstract class LocalDbRealmBase extends LocalDbBase {
  protected override readyDb: Promise<RealmDBAgent>;

  constructor() {
    super();
    this.readyDb = this._openDb();
  }

  // ---------------------------------------------- private methods
  private async _openDb() {
    const realm = await Realm.open({
      path: REALM_DB_NAME,
      schema: realmDBSchemas as any,
      schemaVersion: REALM_DB_VERSION,
      onMigration: (oldRealm: Realm, newRealm: Realm) => {
        const oldVersion = oldRealm.schemaVersion;
        const newVersion = newRealm.schemaVersion;
        console.log(oldVersion, newVersion);
        // do nothing here, add migration logic on service layer
      },
    });
    if (process.env.NODE_ENV !== 'production') {
      global.$$realm = realm;
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
    await db.withTransaction(async () => {
      await Promise.all([
        db._getOrAddObjectRecord(ELocalDBStoreNames.Context, {
          id: DB_MAIN_CONTEXT_ID,
          nextHD: 1,
          nextWalletNo: 1,
          verifyString: DEFAULT_VERIFY_STRING,
          backupUUID: generateUUID(),
        }),
        this._addSingletonWalletRecord({
          db,
          walletId: WALLET_TYPE_IMPORTED,
        }),
        this._addSingletonWalletRecord({
          db,
          walletId: WALLET_TYPE_WATCHING,
        }),
        this._addSingletonWalletRecord({
          db,
          walletId: WALLET_TYPE_EXTERNAL,
        }),
      ]);
    });
  }

  private _addSingletonWalletRecord({
    db,
    walletId,
  }: {
    db: RealmDBAgent;
    walletId: IDBWalletIdSingleton;
  }) {
    db._getOrAddObjectRecord(ELocalDBStoreNames.Wallet, {
      id: walletId,
      name: walletId,
      type: walletId,
      backuped: true,
      accounts: [],
      nextIndex: 0,
      walletNo: 0,
      nextAccountIds: { 'global': 1 },
    });
  }

  deleteDb() {
    try {
      Realm.deleteFile({ path: REALM_DB_NAME });
      return Promise.resolve();
    } catch (error: any) {
      console.error(error);
      return Promise.reject(error);
    }
  }
}
