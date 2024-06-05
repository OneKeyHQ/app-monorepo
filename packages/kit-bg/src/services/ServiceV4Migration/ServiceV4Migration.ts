import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import v4dbHubs from '../../migrations/v4ToV5Migration/v4dbHubs';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { EV4LocalDBStoreNames } from '../../migrations/v4ToV5Migration/v4local/v4localDBStoreNames';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { V4MigrationForAccount } from '../../migrations/v4ToV5Migration/V4MigrationForAccount';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { V4MigrationForAddressBook } from '../../migrations/v4ToV5Migration/V4MigrationForAddressBook';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { V4MigrationForHistory } from '../../migrations/v4ToV5Migration/V4MigrationForHistory';
import ServiceBase from '../ServiceBase';

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import type { IV4MigrationPayload } from '../../migrations/v4ToV5Migration/types';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import type { V4LocalDbRealm } from '../../migrations/v4ToV5Migration/v4local/v4realm/V4LocalDbRealm';

@backgroundClass()
class ServiceV4Migration extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  migrationAccount = new V4MigrationForAccount({
    backgroundApi: this.backgroundApi,
  });

  migrationAddressBook = new V4MigrationForAddressBook({
    backgroundApi: this.backgroundApi,
  });

  migrationHistory = new V4MigrationForHistory({
    backgroundApi: this.backgroundApi,
  });

  // TODO clear migrationPayload when exit migration or focus home page
  migrationPayload: IV4MigrationPayload | undefined;

  async getMigrationPassword() {
    const pwd = this.migrationPayload?.password || '';
    if (!pwd) {
      throw new Error('Migration password not set');
    }
    return pwd;
  }

  async getMigrationPayload() {
    return this.migrationPayload;
  }

  @backgroundMethod()
  async testShowData() {
    const data = await v4dbHubs.v4reduxDb.reduxData;
    const simpleDbAccountHistory =
      await v4dbHubs.v4simpleDb.history.getAccountHistory({
        accountId: 'hd-1--1',
        networkId: 'evm--1',
      });
    const dbWallets = await v4dbHubs.v4localDb.getAllRecords({
      name: EV4LocalDBStoreNames.Wallet,
    });
    const dbAccounts = await v4dbHubs.v4localDb.getAllRecords({
      name: EV4LocalDBStoreNames.Account,
    });
    const allAccounts = dbAccounts.records;
    const dbWallet = dbWallets.records[0];
    const result = {
      simpleDbAccountHistory,
      reduxSettings: data?.settings,
      dbWallet,
      accounts: dbWallet.accounts,
      associatedDevice: dbWallet.associatedDevice,
      allAccounts: dbAccounts.records,
    };
    console.log('testV4MigrationData', result);
    console.log(
      'testV4MigrationData allAccounts ============',
      JSON.stringify(allAccounts, null, 2),
    );
    console.log(
      'testV4MigrationData wallet ============',
      JSON.stringify(dbWallets.records, null, 2),
    );
    if (platformEnv.isNative) {
      console.log({
        dbVersion: (await (global.$$localDbV4 as V4LocalDbRealm).readyDb)?.realm
          ?.schemaVersion,
        dbName: (await (global.$$localDbV4 as V4LocalDbRealm).readyDb)?.realm
          ?.path,
      });
    }
    return result;
  }

  @backgroundMethod()
  async checkShouldMigrateV4() {
    return true;
  }

  @backgroundMethod()
  async prepareMigration(): Promise<IV4MigrationPayload> {
    this.migrationPayload = undefined;
    let migratePasswordOk = false;
    try {
      // TODO if v4 not set password, should not prompt password
      migratePasswordOk = await this.migrationAccount.migrateV4PasswordToV5();
    } catch (error) {
      //
    }
    const passwordRes =
      await this.backgroundApi.servicePassword.promptPasswordVerify({
        reason: EReasonForNeedPassword.Security,
      });
    const wallets = await this.migrationAccount.getV4Wallets();
    const walletsForBackup =
      await this.migrationAccount.buildV4WalletsForBackup({
        v4wallets: wallets,
      });
    this.migrationPayload = {
      password: passwordRes.password,
      v4password: '',
      migratePasswordOk,
      shouldBackup: walletsForBackup.length > 0,
      wallets,
      walletsForBackup,
    };
    return this.migrationPayload;
  }

  @backgroundMethod()
  async getV4WalletsForBackup() {
    return this.migrationPayload?.walletsForBackup;
  }

  @backgroundMethod()
  async revealV4HdMnemonic({ hdWalletId }: { hdWalletId: string }) {
    return this.migrationAccount.revealV4HdMnemonic({ hdWalletId });
  }

  @backgroundMethod()
  async revealV4ImportedPrivateKey({ accountId }: { accountId: string }) {
    return this.migrationAccount.revealV4ImportedPrivateKey({ accountId });
  }

  @backgroundMethod()
  async startV4MigrationFlow() {
    const wallets = this.migrationPayload?.wallets || [];
    // **** migrate accounts
    for (const wallet of wallets) {
      if (wallet.isHw) {
        await this.migrationAccount.migrateHwWallet({
          v4wallet: wallet.wallet,
        });
      }
      if (wallet.isHD) {
        await this.migrationAccount.migrateHdWallet({
          v4wallet: wallet.wallet,
        });
      }
      if (wallet.isImported) {
        await this.migrationAccount.migrateImportedAccounts({
          v4wallet: wallet.wallet,
        });
      }
      if (wallet.isWatching) {
        await this.migrationAccount.migrateWatchingAccounts({
          v4wallet: wallet.wallet,
        });
      }
    }

    // **** migrate address book
    // TODO

    // **** migrate history
    // TODO

    // ----------------------------------------------
    this.migrationPayload = undefined;
    // TODO skip backup within flow
    void this.backgroundApi.serviceCloudBackup.requestAutoBackup();
  }
}

export default ServiceV4Migration;
