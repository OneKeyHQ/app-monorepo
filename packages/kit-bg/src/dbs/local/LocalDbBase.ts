/* eslint-disable @typescript-eslint/no-unused-vars */
import { Buffer } from 'buffer';

import { isNil, max } from 'lodash';
import natsort from 'natsort';

import { decrypt, encrypt } from '@onekeyhq/core/src/secret';
import {
  OneKeyInternalError,
  PasswordNotSet,
  WrongPassword,
} from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IAvatar } from '@onekeyhq/shared/src/utils/emojiUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import {
  DB_MAIN_CONTEXT_ID,
  DEFAULT_VERIFY_STRING,
  WALLET_TYPE_HD,
  WALLET_TYPE_WATCHING,
} from './consts';
import { ELocalDBStoreNames } from './localDBStoreNames';
import {
  type IDBAccount,
  type IDBAccountDerivation,
  type IDBAddAccountDerivationParams,
  type IDBApiGetContextOptions,
  type IDBContext,
  type IDBCreateHDWalletParams,
  type IDBCreateHWWalletParams,
  type IDBCredentialBase,
  type IDBDevicePayload,
  type IDBIndexedAccount,
  type IDBSetAccountTemplateParams,
  type IDBSetNextAccountIdsParams,
  type IDBSetWalletNameAndAvatarParams,
  type IDBStoredPrivateKeyCredential,
  type IDBStoredSeedCredential,
  type IDBWallet,
  type IDBWalletId,
  type ILocalDBAgent,
  type ILocalDBGetAllRecordsParams,
  type ILocalDBGetAllRecordsResult,
  type ILocalDBGetRecordByIdParams,
  type ILocalDBGetRecordByIdResult,
  type ILocalDBRecordUpdater,
  type ILocalDBTransaction,
  type ILocalDBTxAddRecordsParams,
  type ILocalDBTxGetAllRecordsParams,
  type ILocalDBTxGetAllRecordsResult,
  type ILocalDBTxGetRecordByIdParams,
  type ILocalDBTxGetRecordByIdResult,
  type ILocalDBTxRemoveRecordsParams,
  type ILocalDBTxUpdateRecordsParams,
  type ILocalDBWithTransactionTask,
} from './types';

import type { Device } from '@onekeyfe/hd-core';

export abstract class LocalDbBase implements ILocalDBAgent {
  protected abstract readyDb: Promise<ILocalDBAgent>;

  async withTransaction<T>(task: ILocalDBWithTransactionTask<T>): Promise<T> {
    throw new Error(
      'Directly call withTransaction() is NOT allowed, please use (await this.readyDb).withTransaction() at DB layer',
    );
    // const db = await this.readyDb;
    // return db.withTransaction(task);
  }

  async getAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBGetAllRecordsParams<T>,
  ): Promise<ILocalDBGetAllRecordsResult<T>> {
    const db = await this.readyDb;
    return db.getAllRecords(params);
  }

  async getRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordByIdParams<T>,
  ): Promise<ILocalDBGetRecordByIdResult<T>> {
    const db = await this.readyDb;
    return db.getRecordById(params);
  }

  async txGetAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetAllRecordsParams<T>,
  ): Promise<ILocalDBTxGetAllRecordsResult<T>> {
    const db = await this.readyDb;
    return db.txGetAllRecords(params);
  }

  async txGetRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordByIdParams<T>,
  ): Promise<ILocalDBTxGetRecordByIdResult<T>> {
    const db = await this.readyDb;
    return db.txGetRecordById(params);
  }

  async txUpdateRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxUpdateRecordsParams<T>,
  ): Promise<void> {
    const db = await this.readyDb;
    // const a = db.txAddRecords['hello-world-test-error-stack-8889273']['name'];
    return db.txUpdateRecords(params);
  }

  async txAddRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxAddRecordsParams<T>,
  ): Promise<void> {
    const db = await this.readyDb;
    return db.txAddRecords(params);
  }

  async txRemoveRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxRemoveRecordsParams<T>,
  ): Promise<void> {
    const db = await this.readyDb;
    return db.txRemoveRecords(params);
  }

  // ---------------------------------------------- common

  // getDBContext(){

  // }

  // ---------------------------------------------- base
  abstract reset(): Promise<void>;

  confirmHDWalletBackuped(walletId: string): Promise<IDBWallet> {
    throw new Error('Method not implemented.');
  }

  async getContext(
    options?: IDBApiGetContextOptions | undefined,
  ): Promise<IDBContext> {
    const ctx = await this.getRecordById({
      name: ELocalDBStoreNames.Context,
      id: DB_MAIN_CONTEXT_ID,
    });

    if (!ctx) {
      throw new Error('failed get local db context');
    }

    if (options?.verifyPassword) {
      const { verifyPassword } = options;
      if (!this.checkPassword(ctx, verifyPassword)) {
        throw new WrongPassword();
      }
    }
    return ctx;
  }

  async txGetContext({ tx }: { tx: ILocalDBTransaction }) {
    return this.txGetRecordById({
      name: ELocalDBStoreNames.Context,
      id: DB_MAIN_CONTEXT_ID,
      tx,
    });
  }

  async txUpdateContext({
    tx,
    updater,
  }: {
    tx: ILocalDBTransaction;
    updater: ILocalDBRecordUpdater<ELocalDBStoreNames.Context>;
  }) {
    const db = await this.readyDb;
    await db.txUpdateRecords({
      name: ELocalDBStoreNames.Context,
      ids: [DB_MAIN_CONTEXT_ID],
      tx,
      updater,
    });
  }

  async getBackupUUID(): Promise<string> {
    const db = await this.readyDb;
    const context = await this.getContext();
    const { backupUUID } = context;
    if (!isNil(backupUUID)) {
      return backupUUID;
    }
    const newBackupUUID = generateUUID();
    await db.withTransaction(async (tx) =>
      this.txUpdateContext({
        tx,
        updater: (record) => {
          record.backupUUID = newBackupUUID;
          return Promise.resolve(record);
        },
      }),
    );
    return newBackupUUID;
  }

  // ---------------------------------------------- credential
  checkPassword(context: IDBContext, password: string): boolean {
    if (!context) {
      console.error('Unable to get main context.');
      return false;
    }
    if (context.verifyString === DEFAULT_VERIFY_STRING) {
      return false;
    }
    try {
      return (
        decrypt(
          password,
          Buffer.from(context.verifyString, 'hex'),
        ).toString() === DEFAULT_VERIFY_STRING
      );
    } catch {
      return false;
    }
  }

  async verifyPassword(password: string): Promise<void> {
    const ctx = await this.getContext();
    if (ctx && ctx.verifyString !== DEFAULT_VERIFY_STRING) {
      const isValid = this.checkPassword(ctx, password);
      if (isValid) {
        return;
      }
      if (!isValid) {
        throw new WrongPassword();
      }
    }
    throw new PasswordNotSet();
  }

  async isPasswordSet(): Promise<boolean> {
    const ctx = await this.getContext();
    if (ctx && ctx.verifyString !== DEFAULT_VERIFY_STRING) {
      return true;
    }
    return false;
  }

  async txUpdateAllCredentialsPassword({
    tx,
    oldPassword,
    newPassword,
  }: {
    oldPassword: string;
    newPassword: string;
    tx: ILocalDBTransaction;
  }) {
    const db = await this.readyDb;
    if (!oldPassword || !newPassword) {
      throw new Error('password is required');
    }

    // update all credentials
    const { recordPairs: credentialsRecordPairs } = await db.txGetAllRecords({
      tx,
      name: ELocalDBStoreNames.Credential,
    });

    await db.txUpdateRecords({
      tx,
      recordPairs: credentialsRecordPairs,
      name: ELocalDBStoreNames.Credential,
      updater: (credential) => {
        if (credential.id.startsWith('imported')) {
          const privateKeyCredentialJSON: IDBStoredPrivateKeyCredential =
            JSON.parse(credential.credential);
          credential.credential = JSON.stringify({
            privateKey: encrypt(
              newPassword,
              decrypt(
                oldPassword,
                Buffer.from(privateKeyCredentialJSON.privateKey, 'hex'),
              ),
            ).toString('hex'),
          });
        } else {
          const credentialJSON: IDBStoredSeedCredential = JSON.parse(
            credential.credential,
          );
          credential.credential = JSON.stringify({
            entropy: encrypt(
              newPassword,
              decrypt(oldPassword, Buffer.from(credentialJSON.entropy, 'hex')),
            ).toString('hex'),
            seed: encrypt(
              newPassword,
              decrypt(oldPassword, Buffer.from(credentialJSON.seed, 'hex')),
            ).toString('hex'),
          });
        }

        return credential;
      },
    });
  }

  async setPassword({ password }: { password: string }): Promise<void> {
    return this.updatePassword({
      oldPassword: '',
      newPassword: password,
      isCreateMode: true,
    });
  }

  async updatePassword({
    oldPassword,
    newPassword,
    isCreateMode,
  }: {
    oldPassword: string;
    newPassword: string;
    isCreateMode?: boolean;
  }): Promise<void> {
    const db = await this.readyDb;
    if (oldPassword) {
      await this.verifyPassword(oldPassword);
    }
    if (!oldPassword && !isCreateMode) {
      throw new Error('changePassword ERROR: oldPassword is required');
    }
    await db.withTransaction(async (tx) => {
      if (oldPassword) {
        // update all credentials
        await this.txUpdateAllCredentialsPassword({
          tx,
          oldPassword,
          newPassword,
        });
      }

      // update context verifyString
      await this.txUpdateContext({
        tx,
        updater: (record) => {
          record.verifyString = encrypt(
            newPassword,
            Buffer.from(DEFAULT_VERIFY_STRING),
          ).toString('hex');
          return record;
        },
      });
    });
  }

  dumpCredentials(password: string): Promise<Record<string, string>> {
    throw new Error('Method not implemented.');
  }

  async getCredential(credentialId: string): Promise<IDBCredentialBase> {
    const db = await this.readyDb;
    const credential = await db.getRecordById({
      name: ELocalDBStoreNames.Credential,
      id: credentialId,
    });
    return credential;
  }

  // ---------------------------------------------- wallet

  async txUpdateWallet({
    tx,
    walletId,
    updater,
  }: {
    tx: ILocalDBTransaction;
    walletId: IDBWalletId;
    updater: ILocalDBRecordUpdater<ELocalDBStoreNames.Wallet>;
  }) {
    await this.txUpdateRecords({
      tx,
      name: ELocalDBStoreNames.Wallet,
      ids: [walletId],
      updater,
    });
  }

  async txGetWallet({
    tx,
    walletId,
  }: {
    tx: ILocalDBTransaction;
    walletId: IDBWalletId;
  }) {
    return this.txGetRecordById({
      name: ELocalDBStoreNames.Wallet,
      id: walletId,
      tx,
    });
  }

  // eslint-disable-next-line spellcheck/spell-checker
  /**
   * Get all wallets

   * @param includeAllPassphraseWallet Whether to load the hidden Pa
ssphrase wallet
   * @param displayPassphraseWalletIds Need to display Passphrase wallet

   */

  async getWallets(
    option?:
      | {
          includeAllPassphraseWallet?: boolean | undefined;
          displayPassphraseWalletIds?: string[] | undefined;
        }
      | undefined,
  ): Promise<{ wallets: IDBWallet[] }> {
    const db = await this.readyDb;
    const { records } = await db.getAllRecords({
      name: ELocalDBStoreNames.Wallet,
    });
    return {
      wallets: records
        .map((w) => this.refillWalletInfo({ wallet: w }))
        .sort((a, b) => natsort({ insensitive: true })(a.name, b.name)),
    };
  }

  async getWallet({ walletId }: { walletId: string }): Promise<IDBWallet> {
    const db = await this.readyDb;
    const wallet = await db.getRecordById({
      name: ELocalDBStoreNames.Wallet,
      id: walletId,
    });
    return this.refillWalletInfo({ wallet });
  }

  refillWalletInfo({ wallet }: { wallet: IDBWallet }) {
    let avatarInfo: IAvatar | undefined;
    const parsedAvatar: IAvatar = JSON.parse(wallet.avatar || '{}');
    if (Object.keys(parsedAvatar).length > 0) {
      avatarInfo = parsedAvatar;
    }
    wallet.avatarInfo = avatarInfo;
    return wallet;
  }

  getWalletByDeviceId(deviceId: string): Promise<IDBWallet[]> {
    throw new Error('Method not implemented.');
  }

  async getIndexedAccount({ id }: { id: string }) {
    const db = await this.readyDb;
    return db.getRecordById({
      name: ELocalDBStoreNames.IndexedAccount,
      id,
    });
  }

  async getHDIndexedAccountsOfWallet({ walletId }: { walletId: string }) {
    const db = await this.readyDb;
    const { records } = await db.getAllRecords({
      name: ELocalDBStoreNames.IndexedAccount,
    });
    return {
      accounts: records.filter((item) => item.walletId === walletId),
    };
  }

  async addHDIndexedAccount({
    walletId,
    indexes,
    skipIfExists,
  }: {
    walletId: string;
    indexes: number[];
    skipIfExists: boolean;
  }) {
    const db = await this.readyDb;
    await db.withTransaction(async (tx) => {
      await this.txAddHDIndexedAccount({
        tx,
        walletId,
        skipIfExists,
        indexes,
      });
    });
  }

  async txAddHDIndexedAccount({
    tx,
    walletId,
    indexes,
    skipIfExists,
  }: {
    tx: ILocalDBTransaction;
    walletId: string;
    indexes: number[];
    skipIfExists: boolean;
  }) {
    if (!accountUtils.isHdWallet({ walletId })) {
      throw new OneKeyInternalError({
        message: `txAddHDIndexedAccount ERROR: not hd wallet "${walletId}"`,
      });
    }
    const records: IDBIndexedAccount[] = indexes.map((index) => ({
      id: accountUtils.buildIndexedAccountId({ walletId, index }),
      walletId,
      index,
      name: `Account #${index + 1}`, // TODO i18n name
    }));
    console.log('txAddHDIndexedAccount txAddRecords');
    await this.txAddRecords({
      tx,
      skipIfExists,
      name: ELocalDBStoreNames.IndexedAccount,
      records,
    });
    console.log('txAddHDIndexedAccount txGetWallet');
    const [wallet] = await this.txGetWallet({
      tx,
      walletId,
    });
    const { nextIndex } = wallet;
    const maxIndex = max(indexes);
    if (!isNil(maxIndex) && maxIndex >= nextIndex) {
      await this.txUpdateWallet({
        tx,
        walletId,
        updater: (w) => {
          w.nextIndex = maxIndex + 1;
          return w;
        },
      });
    }
  }

  async addHDNextIndexedAccount({ walletId }: { walletId: string }) {
    const db = await this.readyDb;
    let indexedAccountId = '';
    await db.withTransaction(async (tx) => {
      ({ indexedAccountId } = await this.txAddHDNextIndexedAccount({
        tx,
        walletId,
      }));
    });
    return {
      indexedAccountId,
    };
  }

  async txAddHDNextIndexedAccount({
    tx,
    walletId,
  }: {
    tx: ILocalDBTransaction;
    walletId: string;
  }) {
    console.log('txAddHDNextIndexedAccount');
    const [wallet] = await this.txGetWallet({
      tx,
      walletId,
    });
    console.log('txAddHDNextIndexedAccount get wallet', wallet);
    const { nextIndex } = wallet;
    await this.txAddHDIndexedAccount({
      tx,
      walletId,
      indexes: [nextIndex],
      skipIfExists: true,
    });
    return {
      nextIndex,
      indexedAccountId: accountUtils.buildIndexedAccountId({
        walletId,
        index: nextIndex,
      }),
    };
  }

  async createHDWallet(
    params: IDBCreateHDWalletParams,
  ): Promise<{ wallet: IDBWallet; indexedAccount: IDBIndexedAccount }> {
    const db = await this.readyDb;
    const { password, name, avatar, backuped, nextAccountIds, rs } = params;
    const context = await this.getContext({ verifyPassword: password });
    const walletId = accountUtils.buildHdWalletId({
      nextHD: context.nextHD,
    });
    // TODO wallet name i18n?
    const walletName = name || `Wallet ${context.nextHD}`;
    const firstAccountIndex = 0;

    let addedHdAccountIndex = -1;
    await db.withTransaction(async (tx) => {
      console.log('add db wallet');
      // add db wallet
      await this.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Wallet,
        records: [
          {
            id: walletId,
            name: walletName,
            avatar: avatar && JSON.stringify(avatar), // TODO save object to realmDB?
            type: WALLET_TYPE_HD,
            backuped,
            nextAccountIds: nextAccountIds ?? {},
            accounts: [],
            nextIndex: firstAccountIndex,
          },
        ],
      });
      console.log('add db credential');
      // add db credential
      await this.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Credential,
        records: [
          {
            id: walletId,
            // type: 'hd',
            // TODO save object to realmDB?
            credential: rs,
          },
        ],
      });

      console.log('add first indexed account');
      // add first indexed account
      const { nextIndex } = await this.txAddHDNextIndexedAccount({
        tx,
        walletId,
      });
      addedHdAccountIndex = nextIndex;

      console.log('increase nextHD');
      // increase nextHD
      await this.txUpdateContext({
        tx,
        updater: (ctx) => {
          ctx.nextHD += 1;
          return ctx;
        },
      });
    });

    const dbWallet = await this.getWallet({
      walletId,
    });

    const dbIndexedAccount = await this.getIndexedAccount({
      id: accountUtils.buildIndexedAccountId({
        walletId: dbWallet.id,
        index: addedHdAccountIndex,
      }),
    });
    return { wallet: dbWallet, indexedAccount: dbIndexedAccount };
  }

  addHWWallet(params: IDBCreateHWWalletParams): Promise<IDBWallet> {
    throw new Error('Method not implemented.');
  }

  removeWallet(walletId: string, password: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  updateWalletName(walletId: string, name: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  setWalletNameAndAvatar(
    walletId: string,
    params: IDBSetWalletNameAndAvatarParams,
  ): Promise<IDBWallet> {
    throw new Error('Method not implemented.');
  }

  updateWalletNextAccountIds({
    walletId,
    nextAccountIds,
  }: IDBSetNextAccountIdsParams): Promise<IDBWallet> {
    throw new Error('Method not implemented.');
  }

  confirmWalletCreated(walletId: string): Promise<IDBWallet> {
    throw new Error('Method not implemented.');
  }

  cleanupPendingWallets(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async addAccountsToWallet({
    walletId,
    accounts,
  }: {
    walletId: string;
    accounts: IDBAccount[];
    // importedCredential?: IDBPrivateKeyCredential | undefined,}
  }): Promise<void> {
    const db = await this.readyDb;
    await db.withTransaction(async (tx) => {
      await db.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Account,
        records: accounts,
        skipIfExists: true,
      });
      // TODO should add accountId to wallet.accounts or wallet.indexedAccounts?
    });
  }

  // ---------------------------------------------- account
  async getAccount({ accountId }: { accountId: string }): Promise<IDBAccount> {
    const db = await this.readyDb;
    return db.getRecordById({
      name: ELocalDBStoreNames.Account,
      id: accountId,
    });
  }

  getAllAccounts(): Promise<IDBAccount[]> {
    throw new Error('Method not implemented.');
  }

  getAccounts(accountIds: string[]): Promise<IDBAccount[]> {
    throw new Error('Method not implemented.');
  }

  getAccountByAddress(params: {
    address: string;
    coinType?: string | undefined;
  }): Promise<IDBAccount> {
    throw new Error('Method not implemented.');
  }

  removeAccount(
    walletId: string,
    accountId: string,
    password: string,
    rollbackNextAccountIds: Record<string, number>,
    skipPasswordCheck?: boolean | undefined,
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  setAccountName(accountId: string, name: string): Promise<IDBAccount> {
    throw new Error('Method not implemented.');
  }

  setAccountTemplate({
    accountId,
    template,
  }: IDBSetAccountTemplateParams): Promise<IDBAccount> {
    throw new Error('Method not implemented.');
  }

  updateAccountAddresses(
    accountId: string,
    networkId: string,
    address: string,
  ): Promise<IDBAccount> {
    throw new Error('Method not implemented.');
  }

  updateUTXOAccountAddresses({
    accountId,
    addresses,
    isCustomPath,
  }: {
    accountId: string;
    addresses: Record<string, string>;
    isCustomPath: boolean;
  }): Promise<IDBAccount> {
    throw new Error('Method not implemented.');
  }

  removeUTXOAccountAddresses({
    accountId,
    addresses,
    isCustomPath,
  }: {
    accountId: string;
    addresses: Record<string, string>;
    isCustomPath: boolean;
  }): Promise<IDBAccount> {
    throw new Error('Method not implemented.');
  }

  addAccountDerivation({
    walletId,
    accountId,
    impl,
    template,
  }: IDBAddAccountDerivationParams): Promise<void> {
    throw new Error('Method not implemented.');
  }

  removeAccountDerivation({
    walletId,
    impl,
    template,
  }: {
    walletId: string;
    impl: string;
    template: string;
  }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  removeAccountDerivationByWalletId({
    walletId,
  }: {
    walletId: string;
  }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  removeAccountDerivationByAccountId({
    walletId,
    accountId,
  }: {
    walletId: string;
    accountId: string;
  }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getAccountDerivationByWalletId({
    walletId,
  }: {
    walletId: string;
  }): Promise<Record<string, IDBAccountDerivation>> {
    throw new Error('Method not implemented.');
  }

  // ---------------------------------------------- device
  getDevices(): Promise<Device[]> {
    throw new Error('Method not implemented.');
  }

  getDevice(deviceId: string): Promise<Device> {
    throw new Error('Method not implemented.');
  }

  getDeviceByDeviceId(deviceId: string): Promise<Device> {
    throw new Error('Method not implemented.');
  }

  updateDevicePayload(
    deviceId: string,
    payload: IDBDevicePayload,
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  // ---------------------------------------------- demo
  async demoGetDbContext() {
    const db = await this.readyDb;
    const c = await this.getContext();

    const ctx = await db.withTransaction(async (tx) => {
      // Uncaught (in promise) DOMException: Failed to execute 'abort' on 'IDBTransaction': The transaction has finished.
      // const [c] = await localDb.getRecordByIdFull({
      //   name: ELocalDBStoreNames.Context,
      //   id: DB_MAIN_CONTEXT_ID,
      // });

      const { recordPairs: recordPairs2 } = await this.txGetAllRecords({
        tx,
        name: ELocalDBStoreNames.Credential,
      });

      return {
        context: c,
        backupUUID: c.backupUUID,
        recordPairs2: recordPairs2.map((r) => r[0]),
      };
    });

    // const ctx = await localDb.getContext();
    return ctx;
  }

  async demoDbUpdateUUID() {
    const db = await this.readyDb;
    const ctx = await db.withTransaction(async (tx) => {
      await this.txUpdateContext({
        tx,
        updater: (r) => {
          r.backupUUID = generateUUID();
          return Promise.resolve(r);
        },
      });

      // await wait(5000);
      // throw new Error('test error');

      await this.txUpdateWallet({
        tx,
        walletId: WALLET_TYPE_WATCHING,
        updater: (r) => {
          r.name = `hello world: ${Date.now()}`;
          return Promise.resolve(r);
        },
      });

      const [c] = await this.txGetContext({ tx });

      const [watchingWallet] = await this.txGetWallet({
        tx,
        walletId: WALLET_TYPE_WATCHING,
      });

      return {
        context: c,
        watchingWallet,
        backupUUID: c.backupUUID,
        walletName: watchingWallet.name,
      };
    });

    // const ctx = await localDb.getContext();
    return ctx;
  }

  async demoDbUpdateUUIDFixed() {
    const db = await this.readyDb;
    const ctx = await db.withTransaction(async (tx) => {
      const contextRecordPair = await this.txGetContext({ tx });

      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Context,
        recordPairs: [contextRecordPair],
        updater: (r) => {
          r.backupUUID = '1111';
          return Promise.resolve(r);
        },
      });

      const [c] = await this.txGetContext({ tx });

      return {
        context: c,
        backupUUID: c.backupUUID,
      };
    });

    // const ctx = await localDb.getContext();
    return ctx;
  }

  async demoAddRecord1() {
    const db = await this.readyDb;
    const ctx = await db.withTransaction(async (tx) => {
      const id = generateUUID();
      await this.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Credential,
        records: [
          {
            id,
            // type: 'hd',
            credential: '8888',
          },
        ],
      });

      const [c] = await this.txGetRecordById({
        tx,
        name: ELocalDBStoreNames.Credential,
        id,
      });

      return {
        c,
        credential: c.credential,
      };
    });

    // const ctx = await localDb.getContext();
    return ctx;
  }

  async demoRemoveRecord1() {
    const db = await this.readyDb;
    const ctx = await db.withTransaction(async (tx) => {
      const { recordPairs } = await this.txGetAllRecords({
        tx,
        name: ELocalDBStoreNames.Credential,
      });
      await Promise.all(
        recordPairs.map((r) =>
          this.txRemoveRecords({
            tx,
            name: ELocalDBStoreNames.Credential,
            recordPairs: [r],
          }),
        ),
      );
      const { recordPairs: recordPairs2 } = await this.txGetAllRecords({
        tx,
        name: ELocalDBStoreNames.Credential,
      });

      return {
        recordPairs: recordPairs.map((r) => r[0]),
        recordPairs2: recordPairs2.map((r) => r[0]),
        // c,
        // credential: c.credential,
      };
    });

    // const ctx = await localDb.getContext();
    return ctx;
  }

  // TODO long time logic, multiple transaction
  async demoUpdateCredentialRecord() {
    const db = await this.readyDb;
    const ctx = await db.withTransaction(async (tx) => {
      const { recordPairs } = await this.txGetAllRecords({
        tx,
        name: ELocalDBStoreNames.Credential,
      });
      await Promise.all(
        recordPairs.map((r) =>
          this.txUpdateRecords({
            tx,
            name: ELocalDBStoreNames.Credential,
            recordPairs: [r],
            updater: (r0) => {
              r0.credential = '6666';
              return Promise.resolve(r0);
            },
          }),
        ),
      );
      const { recordPairs: recordPairs2 } = await this.txGetAllRecords({
        tx,
        name: ELocalDBStoreNames.Credential,
      });

      // await wait(5000);
      // throw new Error('failed');

      return {
        recordPairs: recordPairs.map((r) => r[0]),
        recordPairs2: recordPairs2.map((r) => r[0]),
        // c,
        // credential: c.credential,
      };
    });

    // const ctx = await localDb.getContext();
    return ctx;
  }
}
