/* eslint-disable @typescript-eslint/no-restricted-imports */
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { v4CoinTypeToNetworkId } from '../../migrations/v4ToV5Migration/v4CoinTypeToNetworkId';
import v4dbHubs from '../../migrations/v4ToV5Migration/v4dbHubs';
import { EV4LocalDBStoreNames } from '../../migrations/v4ToV5Migration/v4local/v4localDBStoreNames';
import { V4MigrationForAccount } from '../../migrations/v4ToV5Migration/V4MigrationForAccount';
import { V4MigrationForAddressBook } from '../../migrations/v4ToV5Migration/V4MigrationForAddressBook';
import { V4MigrationForHistory } from '../../migrations/v4ToV5Migration/V4MigrationForHistory';
import { v4migrationAtom } from '../../states/jotai/atoms/v4migration';
import ServiceBase from '../ServiceBase';

import type { IDBAccount, IDBWallet } from '../../dbs/local/types';
import type {
  IV4MigrationBackupSectionData,
  IV4MigrationBackupSectionDataItem,
  IV4MigrationPayload,
} from '../../migrations/v4ToV5Migration/types';
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
  @toastIfError()
  async checkShouldMigrateV4() {
    // persist migration status to global atom
    return true;
  }

  @backgroundMethod()
  @toastIfError()
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
    let totalWalletsAndAccounts = 0;
    for (const wallet of wallets) {
      if (!wallet.isExternal) {
        if (wallet.isHD || wallet.isHw) {
          totalWalletsAndAccounts += 1;
        }
        totalWalletsAndAccounts += wallet?.wallet?.accounts?.length || 0;
      }
    }
    this.migrationPayload = {
      password: passwordRes.password,
      v4password: '',
      migratePasswordOk,
      shouldBackup: walletsForBackup.length > 0,
      wallets,
      walletsForBackup,
      totalWalletsAndAccounts,
    };
    await v4migrationAtom.set((v) => ({
      progress: 0,
      backedUpMark: {},
    }));
    return this.migrationPayload;
  }

  @backgroundMethod()
  async buildV4WalletsForBackupSectionData() {
    const wallets = this.migrationPayload?.walletsForBackup || [];

    const hdWalletSectionData: IV4MigrationBackupSectionDataItem = {
      title: 'Wallets',
      data: [
        // { hdWallet: undefined }
      ],
    };

    const importedAccountsSectionData: IV4MigrationBackupSectionDataItem = {
      title: 'Private key',
      data: [
        // { importedAccount: undefined }
      ],
    };

    for (const w of wallets) {
      if (w.isHD) {
        hdWalletSectionData.data.push({
          hdWallet: w.wallet,
          backupId: `v4-hd-backup:${w.wallet.id}`,
          title: w.wallet.name || '--',
          subTitle: `${w?.wallet?.accounts?.length || 0} accounts`,
        });
      }
      if (w.isImported) {
        if (w.wallet.accounts.length) {
          for (const accountId of w.wallet.accounts) {
            try {
              const account = await v4dbHubs.v4localDb.getRecordById({
                name: EV4LocalDBStoreNames.Account,
                id: accountId,
              });
              const networkId = v4CoinTypeToNetworkId[account?.coinType];
              const network =
                await this.backgroundApi.serviceNetwork.getNetworkSafe({
                  networkId,
                });
              importedAccountsSectionData.data.push({
                importedAccount: account,
                network,
                backupId: `v4-imported-backup:${account.id}`,
                title: account.name || '--',
                subTitle: accountUtils.shortenAddress({
                  // TODO regenerate address of certain network
                  address: account.address || account.pub || '--',
                }),
              });
            } catch (error) {
              //
            }
          }
        }
      }
    }

    const sectionData: IV4MigrationBackupSectionData = [];

    if (hdWalletSectionData.data.length) {
      sectionData.push(hdWalletSectionData);
    }

    if (importedAccountsSectionData.data.length) {
      sectionData.push(importedAccountsSectionData);
    }

    return sectionData;
  }

  @backgroundMethod()
  @toastIfError()
  async revealV4HdMnemonic({ hdWalletId }: { hdWalletId: string }) {
    return this.migrationAccount.revealV4HdMnemonic({ hdWalletId });
  }

  @backgroundMethod()
  @toastIfError()
  async revealV4ImportedPrivateKey({
    accountId,
    password,
  }: {
    accountId: string;
    password?: string;
  }) {
    return this.migrationAccount.revealV4ImportedPrivateKey({
      accountId,
      password,
    });
  }

  @backgroundMethod()
  @toastIfError()
  async startV4MigrationFlow() {
    const maxProgress = {
      account: 90,
      addressBook: 92,
      history: 95,
    };
    await v4migrationAtom.set((v) => ({
      ...v,
      progress: 0,
    }));
    const wallets = this.migrationPayload?.wallets || [];

    // **** migrate accounts
    const totalWalletsAndAccounts =
      this.migrationPayload?.totalWalletsAndAccounts || 0;
    let actualWalletsAndAccountsMigrated = 0;
    const increaseProgressOfAccount = () => {
      actualWalletsAndAccountsMigrated += 1;
      const progress = Math.min(
        Math.floor(
          (actualWalletsAndAccountsMigrated / totalWalletsAndAccounts) * 100,
        ),
        100,
      );
      void v4migrationAtom.set((v) => ({
        ...v,
        progress: Math.floor((progress * maxProgress.account) / 100),
      }));
    };
    const onWalletMigrated = (v5wallet?: IDBWallet) => {
      increaseProgressOfAccount();
    };
    const onAccountMigrated = (v5account?: IDBAccount) => {
      increaseProgressOfAccount();
    };
    for (const wallet of wallets) {
      if (wallet.isHw) {
        await this.migrationAccount.migrateHwWallet({
          v4wallet: wallet.wallet,
          onWalletMigrated,
          onAccountMigrated,
        });
      }
      if (wallet.isHD) {
        await this.migrationAccount.migrateHdWallet({
          v4wallet: wallet.wallet,
          onWalletMigrated,
          onAccountMigrated,
        });
      }
      if (wallet.isImported) {
        await this.migrationAccount.migrateImportedAccounts({
          v4wallet: wallet.wallet,
          onWalletMigrated,
          onAccountMigrated,
        });
      }
      if (wallet.isWatching) {
        await this.migrationAccount.migrateWatchingAccounts({
          v4wallet: wallet.wallet,
          onWalletMigrated,
          onAccountMigrated,
        });
      }
    }

    // await timerUtils.wait(1000);

    await v4migrationAtom.set((v) => ({
      ...v,
      progress: maxProgress.account,
    }));

    // **** migrate address book
    // TODO

    // **** migrate history
    await this.migrationHistory.migrateLocalPendingTxs();

    // ----------------------------------------------
    this.migrationPayload = undefined;
    // TODO skip backup within flow
    void this.backgroundApi.serviceCloudBackup.requestAutoBackup();

    await v4migrationAtom.set((v) => ({
      ...v,
      progress: 100,
    }));

    return {
      totalWalletsAndAccounts,
      actualWalletsAndAccountsMigrated,
    };
  }
}

export default ServiceV4Migration;
