/* eslint-disable @typescript-eslint/no-unused-vars */
import { Buffer } from 'buffer';

import { isNil, max, uniq } from 'lodash';
import natsort from 'natsort';

import type { IBip39RevealableSeed } from '@onekeyhq/core/src/secret';
import {
  decrypt,
  decryptImportedCredential,
  decryptRevealableSeed,
  encrypt,
  encryptImportedCredential,
  encryptRevealableSeed,
  ensureSensitiveTextEncoded,
  sha256,
} from '@onekeyhq/core/src/secret';
import type {
  ICoreImportedCredential,
  ICoreImportedCredentialEncryptHex,
} from '@onekeyhq/core/src/types';
import {
  DB_MAIN_CONTEXT_ID,
  DEFAULT_VERIFY_STRING,
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import {
  OneKeyInternalError,
  PasswordNotSet,
  WrongPassword,
} from '@onekeyhq/shared/src/errors';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type { IAvatarInfo } from '@onekeyhq/shared/src/utils/emojiUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { EDBAccountType } from './consts';
import { ELocalDBStoreNames } from './localDBStoreNames';

import type {
  IDBAccount,
  IDBAccountDerivation,
  IDBAddAccountDerivationParams,
  IDBAddress,
  IDBApiGetContextOptions,
  IDBContext,
  IDBCreateHDWalletParams,
  IDBCreateHWWalletParams,
  IDBCredentialBase,
  IDBDevice,
  IDBDeviceSettings,
  IDBExternalAccount,
  IDBGetWalletsParams,
  IDBIndexedAccount,
  IDBRemoveWalletParams,
  IDBSetAccountNameParams,
  IDBSetAccountTemplateParams,
  IDBSetWalletNameAndAvatarParams,
  IDBUpdateDeviceSettingsParams,
  IDBUpdateFirmwareVerifiedParams,
  IDBWallet,
  IDBWalletId,
  IDBWalletIdSingleton,
  ILocalDBAgent,
  ILocalDBGetAllRecordsParams,
  ILocalDBGetAllRecordsResult,
  ILocalDBGetRecordByIdParams,
  ILocalDBGetRecordByIdResult,
  ILocalDBGetRecordsCountParams,
  ILocalDBGetRecordsCountResult,
  ILocalDBRecordUpdater,
  ILocalDBTransaction,
  ILocalDBTxAddRecordsParams,
  ILocalDBTxAddRecordsResult,
  ILocalDBTxGetAllRecordsParams,
  ILocalDBTxGetAllRecordsResult,
  ILocalDBTxGetRecordByIdParams,
  ILocalDBTxGetRecordByIdResult,
  ILocalDBTxGetRecordsCountParams,
  ILocalDBTxRemoveRecordsParams,
  ILocalDBTxUpdateRecordsParams,
  ILocalDBWithTransactionTask,
} from './types';

export abstract class LocalDbBase implements ILocalDBAgent {
  protected abstract readyDb: Promise<ILocalDBAgent>;

  tempWallets: {
    [walletId: string]: boolean;
  } = {};

  async withTransaction<T>(task: ILocalDBWithTransactionTask<T>): Promise<T> {
    throw new Error(
      'Directly call withTransaction() is NOT allowed, please use (await this.readyDb).withTransaction() at DB layer',
    );
    // const db = await this.readyDb;
    // return db.withTransaction(task);
  }

  async getRecordsCount<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordsCountParams<T>,
  ): Promise<ILocalDBGetRecordsCountResult> {
    const db = await this.readyDb;
    return db.getRecordsCount(params);
  }

  async txGetRecordsCount<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordsCountParams<T>,
  ): Promise<ILocalDBGetRecordsCountResult> {
    const db = await this.readyDb;
    return db.txGetRecordsCount(params);
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
  ): Promise<ILocalDBTxAddRecordsResult> {
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

  async clearRecords(params: { name: ELocalDBStoreNames }) {
    const db = await this.readyDb;
    return db.clearRecords(params);
  }

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
      ensureSensitiveTextEncoded(verifyPassword);
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

  async resetContext() {
    const db = await this.readyDb;
    await db.withTransaction(async (tx) => {
      await this.txUpdateContext({
        tx,
        updater(item) {
          item.nextHD = 1;
          item.nextWalletNo = 1;
          return item;
        },
      });
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
      ensureSensitiveTextEncoded(password);
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

  async resetPasswordSet(): Promise<void> {
    const db = await this.readyDb;
    await db.withTransaction(async (tx) => {
      await this.txUpdateContext({
        tx,
        updater: (record) => {
          record.verifyString = DEFAULT_VERIFY_STRING;
          return record;
        },
      });
    });
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
          const importedCredential: ICoreImportedCredential =
            decryptImportedCredential({
              credential: credential.credential,
              password: oldPassword,
            });
          credential.credential = encryptImportedCredential({
            credential: importedCredential,
            password: newPassword,
          });
        } else {
          const revealableSeed: IBip39RevealableSeed = decryptRevealableSeed({
            rs: credential.credential,
            password: oldPassword,
          });
          credential.credential = encryptRevealableSeed({
            rs: revealableSeed,
            password: newPassword,
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

  // insert lightning network credential
  async updateLightningCredential({
    credentialId,
    credential,
  }: {
    credentialId: string;
    credential: string;
  }) {
    const db = await this.readyDb;
    await db.withTransaction(async (tx) => {
      await this.txUpdateLightningCredential({
        tx,
        credentialId,
        credential,
        updater: (record) => {
          record.credential = credential;
          return record;
        },
      });
    });
  }

  async txUpdateLightningCredential({
    tx,
    credentialId,
    credential,
    updater,
  }: {
    tx: ILocalDBTransaction;
    credentialId: string;
    credential: string;
    updater: ILocalDBRecordUpdater<ELocalDBStoreNames.Credential>;
  }) {
    await this.txAddRecords({
      tx,
      skipIfExists: true,
      name: ELocalDBStoreNames.Credential,
      records: [
        {
          id: credentialId,
          credential,
        },
      ],
    });
    await this.txUpdateRecords({
      tx,
      name: ELocalDBStoreNames.Credential,
      ids: [credentialId],
      updater,
    });
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

  walletSortFn = (a: IDBWallet, b: IDBWallet) =>
    (a.walletOrder ?? 0) - (b.walletOrder ?? 0);

  // eslint-disable-next-line spellcheck/spell-checker
  /**
   * Get all wallets

   * @param includeAllPassphraseWallet Whether to load the hidden Pa
ssphrase wallet
   * @param displayPassphraseWalletIds Need to display Passphrase wallet

   */

  async getWallets(
    option?: IDBGetWalletsParams,
  ): Promise<{ wallets: IDBWallet[] }> {
    const nestedHiddenWallets = option?.nestedHiddenWallets;
    const db = await this.readyDb;

    // get all wallets for account selector
    let { records } = await db.getAllRecords({
      name: ELocalDBStoreNames.Wallet,
    });
    const hiddenWalletsMap: {
      [dbDeviceId: string]: IDBWallet[];
    } = {};
    records = records.filter((wallet) => {
      if (this.isTempWalletRemoved({ wallet })) {
        return false;
      }
      if (
        nestedHiddenWallets &&
        accountUtils.isHwHiddenWallet({ wallet }) &&
        wallet.associatedDevice
      ) {
        hiddenWalletsMap[wallet.associatedDevice] =
          hiddenWalletsMap[wallet.associatedDevice] || [];
        hiddenWalletsMap[wallet.associatedDevice].push(wallet);
        return false;
      }
      return true;
    });
    records = await Promise.all(
      records.map((w) =>
        this.refillWalletInfo({
          wallet: w,
          hiddenWallets: w.associatedDevice
            ? hiddenWalletsMap[w.associatedDevice]
            : undefined,
        }),
      ),
    );
    records = records.sort(this.walletSortFn);

    return {
      wallets: records,
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

  async getWalletSafe({
    walletId,
  }: {
    walletId: string;
  }): Promise<IDBWallet | undefined> {
    try {
      return await this.getWallet({ walletId });
    } catch (error) {
      return undefined;
    }
  }

  async refillWalletInfo({
    wallet,
    hiddenWallets,
  }: {
    wallet: IDBWallet;
    hiddenWallets?: IDBWallet[];
  }): Promise<IDBWallet> {
    const db = await this.readyDb;
    let avatarInfo: IAvatarInfo | undefined;
    const parsedAvatar: IAvatarInfo = JSON.parse(wallet.avatar || '{}');
    if (Object.keys(parsedAvatar).length > 0) {
      avatarInfo = parsedAvatar;
    }
    wallet.avatarInfo = avatarInfo;
    wallet.walletOrder = wallet.walletNo;
    if (accountUtils.isHwHiddenWallet({ wallet })) {
      const parentWalletId = accountUtils.buildHwWalletId({
        dbDeviceId: wallet.associatedDevice || '',
      });
      const parentWallet = await db.getRecordById({
        name: ELocalDBStoreNames.Wallet,
        id: parentWalletId,
      });
      wallet.walletOrder = parentWallet.walletNo + wallet.walletNo / 1000000;
    }

    if (hiddenWallets && hiddenWallets.length > 0) {
      wallet.hiddenWallets = await Promise.all(
        hiddenWallets.map((item) => this.refillWalletInfo({ wallet: item })),
      );
      wallet.hiddenWallets = wallet.hiddenWallets.sort(this.walletSortFn);
    }

    return wallet;
  }

  async getIndexedAccount({ id }: { id: string }) {
    const db = await this.readyDb;
    return db.getRecordById({
      name: ELocalDBStoreNames.IndexedAccount,
      id,
    });
  }

  async getIndexedAccountByAccount({ account }: { account: IDBAccount }) {
    const accountId = account.id;
    if (
      accountUtils.isHdAccount({ accountId }) ||
      accountUtils.isHwAccount({
        accountId,
      })
    ) {
      const { indexedAccountId } = account;
      if (!indexedAccountId) {
        throw new Error(
          `indexedAccountId is missing from account: ${accountId}`,
        );
      }
      // indexedAccount must be create before account, keep throw error here, do not try catch
      const indexedAccount = await this.getIndexedAccount({
        id: indexedAccountId,
      });
      return indexedAccount;
    }
    return undefined;
  }

  async getIndexedAccounts({ walletId }: { walletId: string }) {
    const db = await this.readyDb;
    let accounts: IDBIndexedAccount[] = [];

    const wallet = await this.getWalletSafe({
      walletId,
    });
    if (wallet) {
      // TODO performance
      const { records } = await db.getAllRecords({
        name: ELocalDBStoreNames.IndexedAccount,
      });
      console.log('getIndexedAccountsOfWallet', records);
      accounts = records.filter((item) => item.walletId === walletId);
    }

    return {
      accounts: accounts.sort((a, b) =>
        // indexedAccount sort by index
        natsort({ insensitive: true })(a.index, b.index),
      ),
    };
  }

  async addIndexedAccount({
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
      await this.txAddIndexedAccount({
        tx,
        walletId,
        skipIfExists,
        indexes,
      });
    });
  }

  async txAddIndexedAccount({
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
    if (
      !accountUtils.isHdWallet({ walletId }) &&
      !accountUtils.isHwWallet({ walletId })
    ) {
      throw new OneKeyInternalError({
        message: `addIndexedAccount ERROR: only hd or hw wallet support "${walletId}"`,
      });
    }
    let dbDevice: IDBDevice | undefined;
    let dbWallet: IDBWallet | undefined;
    if (accountUtils.isHwWallet({ walletId })) {
      [dbWallet] = await this.txGetWallet({ tx, walletId });
      const deviceId = dbWallet.associatedDevice;
      if (deviceId) {
        const [device] = await this.txGetRecordById({
          tx,
          name: ELocalDBStoreNames.Device,
          id: deviceId,
        });
        dbDevice = device;
      }
    }
    const records: IDBIndexedAccount[] = indexes.map((index) => {
      const indexedAccountId = accountUtils.buildIndexedAccountId({
        walletId,
        index,
      });
      const hashBuffer = sha256(
        bufferUtils.toBuffer(
          dbDevice
            ? `${dbDevice.connectId}.${dbDevice.deviceId}.${
                dbDevice.deviceType
              }.${dbWallet?.passphraseState || ''}.${index}`
            : indexedAccountId,
          'utf-8',
        ),
      );
      let idHash = bufferUtils.bytesToHex(hashBuffer);
      idHash = idHash.slice(-42);
      checkIsDefined(idHash);
      return {
        id: indexedAccountId,
        idHash,
        walletId,
        index,
        name: `Account #${index + 1}`, // TODO i18n name
      };
    });
    console.log('txAddIndexedAccount txAddRecords', records);
    await this.txAddRecords({
      tx,
      skipIfExists,
      name: ELocalDBStoreNames.IndexedAccount,
      records,
    });
    console.log('txAddIndexedAccount txGetWallet');
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
    onlyAddFirst,
  }: {
    tx: ILocalDBTransaction;
    walletId: string;
    onlyAddFirst?: boolean;
  }) {
    console.log('txAddHDNextIndexedAccount');
    const [wallet] = await this.txGetWallet({
      tx,
      walletId,
    });
    console.log('txAddHDNextIndexedAccount get wallet', wallet);
    let { nextIndex } = wallet;
    if (onlyAddFirst) {
      nextIndex = 0;
    }
    await this.txAddIndexedAccount({
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

  async buildCreateHDAndHWWalletResult({
    walletId,
    addedHdAccountIndex,
  }: {
    walletId: string;
    addedHdAccountIndex: number;
  }) {
    const dbWallet = await this.getWallet({
      walletId,
    });

    const dbIndexedAccount = await this.getIndexedAccount({
      id: accountUtils.buildIndexedAccountId({
        walletId,
        index: addedHdAccountIndex,
      }),
    });

    let dbDevice: IDBDevice | undefined;
    if (accountUtils.isHwWallet({ walletId })) {
      dbDevice = await this.getWalletDevice({
        walletId,
      });
    }

    return {
      wallet: dbWallet,
      indexedAccount: dbIndexedAccount,
      device: dbDevice,
    };
  }

  async createHDWallet(
    params: IDBCreateHDWalletParams,
  ): Promise<{ wallet: IDBWallet; indexedAccount: IDBIndexedAccount }> {
    const db = await this.readyDb;
    const { password, name, avatar, backuped, rs } = params;
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
            nextAccountIds: {},
            accounts: [],
            nextIndex: firstAccountIndex,
            walletNo: context.nextWalletNo,
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
        onlyAddFirst: true,
      });
      addedHdAccountIndex = nextIndex;

      console.log('increase nextHD');
      // increase nextHD
      await this.txUpdateContext({
        tx,
        updater: (ctx) => {
          ctx.nextHD += 1;
          ctx.nextWalletNo += 1;
          return ctx;
        },
      });
    });

    return this.buildCreateHDAndHWWalletResult({
      walletId,
      addedHdAccountIndex,
    });
  }

  async updateFirmwareVerified(params: IDBUpdateFirmwareVerifiedParams) {
    const db = await this.readyDb;
    await db.withTransaction(async (tx) => {
      const { device, verifyResult } = params;
      const { id, featuresInfo, features } = device;
      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Device,
        ids: [id],
        updater: (item) => {
          if (verifyResult === 'official') {
            const versionText = deviceUtils.getDeviceVersionStr({
              device,
              features: checkIsDefined(featuresInfo),
            });
            // official firmware verified
            item.verifiedAtVersion = versionText;
          }
          if (verifyResult === 'unofficial') {
            // unofficial firmware
            item.verifiedAtVersion = '';
          }
          if (verifyResult === 'unknown') {
            item.verifiedAtVersion = undefined;
          }
          return item;
        },
      });
    });
  }

  // TODO remove unused hidden wallet first
  async createHWWallet(params: IDBCreateHWWalletParams) {
    const db = await this.readyDb;
    const { name, device, features, passphraseState, isFirmwareVerified } =
      params;
    console.log('createHWWallet', features);
    // TODO check features if exists
    const { getDeviceType, getDeviceUUID } = await CoreSDKLoader();
    const { connectId } = device;
    const context = await this.getContext();
    // const serialNo = features.onekey_serial ?? features.serial_no ?? '';
    const deviceType = device.deviceType || getDeviceType(features);
    const deviceUUID = device.uuid || getDeviceUUID(features);
    const rawDeviceId = device.deviceId || features.device_id || '';
    let walletName =
      name ??
      features.label ??
      features.ble_name ??
      `OneKey ${deviceUUID.slice(-4)}`;
    if (passphraseState) {
      // TODO use nextHidden in IDBWallet
      walletName = 'Hidden Wallet #1';
    }
    const avatar: IAvatarInfo = {
      img: deviceType,
    };
    const existingDevice = await this.getExistingDevice({
      rawDeviceId,
      uuid: deviceUUID,
    });
    const dbDeviceId = existingDevice?.id || generateUUID();

    const dbWalletId = accountUtils.buildHwWalletId({
      dbDeviceId,
      passphraseState,
    });
    const featuresStr = JSON.stringify(features);

    const firstAccountIndex = 0;

    let addedHdAccountIndex = -1;

    await db.withTransaction(async (tx) => {
      // add db device
      const now = Date.now();
      await this.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Device,
        skipIfExists: true,
        records: [
          {
            id: dbDeviceId,
            name: walletName,
            connectId: connectId || '',
            uuid: deviceUUID,
            deviceId: rawDeviceId,
            deviceType,
            features: featuresStr,
            settingsRaw: JSON.stringify({
              inputPinOnSoftware: true,
            } as IDBDeviceSettings),
            createdAt: now,
            updatedAt: now,
          },
        ],
      });

      // update exists db device
      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Device,
        ids: [dbDeviceId],
        updater: (item) => {
          item.features = featuresStr;
          item.updatedAt = now;
          if (isFirmwareVerified) {
            const versionText = deviceUtils.getDeviceVersionStr({
              device,
              features,
            });
            // official firmware verified
            item.verifiedAtVersion = versionText;
          } else {
            // skip firmware verify
            item.verifiedAtVersion = undefined;
          }
          return item;
        },
      });

      // add db wallet
      await this.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Wallet,
        skipIfExists: true,
        records: [
          {
            id: dbWalletId,
            name: walletName,
            avatar: avatar && JSON.stringify(avatar),
            type: WALLET_TYPE_HW,
            backuped: true,
            associatedDevice: dbDeviceId,
            isTemp: false,
            passphraseState,
            nextIndex: firstAccountIndex,
            nextAccountIds: {},
            accounts: [],
            walletNo: context.nextWalletNo,
          },
        ],
      });

      await this.txUpdateWallet({
        tx,
        walletId: dbWalletId,
        updater: (item) => {
          item.isTemp = false;
          return item;
        },
      });

      // add first indexed account
      const { nextIndex } = await this.txAddHDNextIndexedAccount({
        tx,
        walletId: dbWalletId,
        onlyAddFirst: true,
      });
      addedHdAccountIndex = nextIndex;

      console.log('increase nextWalletNo');
      // increase nextHD
      await this.txUpdateContext({
        tx,
        updater: (ctx) => {
          ctx.nextWalletNo += 1;
          return ctx;
        },
      });
    });

    if (passphraseState) {
      this.tempWallets[dbWalletId] = true;
    }

    return this.buildCreateHDAndHWWalletResult({
      walletId: dbWalletId,
      addedHdAccountIndex,
    });
  }

  // TODO clean wallets which associatedDevice is removed
  // TODO remove associate indexedAccount and account
  async removeWallet({ walletId }: IDBRemoveWalletParams): Promise<void> {
    const db = await this.readyDb;
    await db.withTransaction(async (tx) => {
      // call remove account & indexed account
      // remove credential
      // remove wallet
      // remove address
      const [wallet] = await this.txGetWallet({
        tx,
        walletId,
      });
      const isHardware = accountUtils.isHwWallet({
        walletId,
      });
      if (isHardware) {
        if (
          wallet.associatedDevice &&
          !accountUtils.isHwHiddenWallet({ wallet })
        ) {
          // remove device
          await this.txRemoveRecords({
            tx,
            name: ELocalDBStoreNames.Device,
            ids: [wallet.associatedDevice],
          });
          // remove all hidden wallets
          const { recordPairs: allWallets } = await this.txGetAllRecords({
            tx,
            name: ELocalDBStoreNames.Wallet,
          });
          const matchedHiddenWallets = allWallets
            .filter(
              (item) =>
                item[0].associatedDevice === wallet.associatedDevice &&
                accountUtils.isHwHiddenWallet({ wallet: item[0] }),
            )
            ?.filter(Boolean);
          if (matchedHiddenWallets) {
            await this.txRemoveRecords({
              name: ELocalDBStoreNames.Wallet,
              tx,
              recordPairs: matchedHiddenWallets,
            });
          }
        }
      } else {
        await this.txRemoveRecords({
          tx,
          name: ELocalDBStoreNames.Credential,
          ids: [walletId],
        });
      }

      await this.txRemoveRecords({
        tx,
        name: ELocalDBStoreNames.Wallet,
        ids: [walletId],
      });

      if (accountUtils.isHdWallet({ walletId }) || isHardware) {
        const { recordPairs: allIndexedAccounts } = await this.txGetAllRecords({
          tx,
          name: ELocalDBStoreNames.IndexedAccount,
        });
        const indexedAccounts = allIndexedAccounts
          .filter((item) => item[0].walletId === walletId)
          .filter(Boolean);
        if (indexedAccounts) {
          await this.txRemoveRecords({
            tx,
            name: ELocalDBStoreNames.IndexedAccount,
            recordPairs: indexedAccounts,
          });
        }
      }
    });

    delete this.tempWallets[walletId];
  }

  isTempWalletRemoved({ wallet }: { wallet: IDBWallet }): boolean {
    return Boolean(wallet.isTemp && !this.tempWallets[wallet.id]);
  }

  async setWalletTempStatus({
    walletId,
    isTemp,
  }: {
    walletId: IDBWalletId;
    isTemp: boolean;
  }) {
    const db = await this.readyDb;
    await db.withTransaction(async (tx) => {
      await this.txUpdateWallet({
        tx,
        walletId,
        updater: (item) => {
          item.isTemp = isTemp;
          return item;
        },
      });
      this.tempWallets[walletId] = true;
    });
  }

  async setWalletNameAndAvatar(
    params: IDBSetWalletNameAndAvatarParams,
  ): Promise<IDBWallet> {
    const db = await this.readyDb;
    const { walletId } = params;
    let wallet = await this.getWallet({ walletId });

    await db.withTransaction(async (tx) => {
      // update wallet name
      await this.txUpdateWallet({
        tx,
        walletId,
        updater: (w) => {
          if (params.name) {
            w.name = params.name || w.name;
          }
          if (params.avatar) {
            w.avatar = params.avatar && JSON.stringify(params.avatar);
          }
          return w;
        },
      });
      // update device name
      if (wallet.associatedDevice) {
        await this.txUpdateRecords({
          tx,
          name: ELocalDBStoreNames.Device,
          ids: [wallet.associatedDevice],
          updater: (item) => {
            if (params.name) {
              item.name = params.name || item.name;
            }
            return item;
          },
        });
      }
    });
    wallet = await this.getWallet({ walletId });
    return wallet;
  }

  isSingletonWallet({ walletId }: { walletId: string }) {
    return (
      walletId === WALLET_TYPE_WATCHING ||
      walletId === WALLET_TYPE_EXTERNAL ||
      walletId === WALLET_TYPE_IMPORTED
    );
  }

  validateAccountsFields(accounts: IDBAccount[]) {
    if (process.env.NODE_ENV !== 'production') {
      accounts.forEach((account) => {
        const accountId = account.id;

        const walletId = accountUtils.getWalletIdFromAccountId({
          accountId,
        });

        const isExternal = accountUtils.isExternalWallet({ walletId });

        if (!account.impl && !isExternal) {
          throw new Error(
            'validateAccountsFields ERROR: account.impl is missing',
          );
        }

        if (account.type === EDBAccountType.VARIANT) {
          if (account.address && !isExternal) {
            throw new Error('VARIANT account should not set account address');
          }
        }

        if (account.type === EDBAccountType.UTXO) {
          if (!account.relPath) {
            throw new Error('UTXO account should set relPath');
          }
        }

        if (
          accountUtils.isHdWallet({ walletId }) ||
          accountUtils.isHwWallet({ walletId })
        ) {
          if (isNil(account.pathIndex)) {
            throw new Error('HD account should set pathIndex');
          }
          if (!account.indexedAccountId) {
            throw new Error('HD account should set indexedAccountId');
          }
        }

        if (
          accountUtils.isImportedWallet({ walletId }) ||
          accountUtils.isWatchingWallet({ walletId })
        ) {
          if (!account.createAtNetwork) {
            throw new Error(
              'imported or watching account should set createAtNetwork',
            );
          }
        }
      });
    }
  }

  async getAccountNameFromAddress({
    networkId,
    address,
    normalizedAddress,
  }: {
    networkId: string;
    address: string;
    normalizedAddress: string;
  }): Promise<Array<{ walletName: string; accountName: string }>> {
    try {
      const db = await this.readyDb;
      let info: IDBAddress | undefined;
      try {
        const id = `${networkId}--${address}`;
        info = await this.getRecordById({
          name: ELocalDBStoreNames.Address,
          id,
        });
      } catch (error) {
        const impl = networkUtils.getNetworkImpl({ networkId });
        const id = `${impl}--${normalizedAddress}`;
        info = await this.getRecordById({
          name: ELocalDBStoreNames.Address,
          id,
        });
      }

      if (info) {
        const result = [];
        const items = Object.entries(info.wallets);
        for (const item of items) {
          const [walletId, accountId] = item;
          try {
            const wallet = await this.getWallet({ walletId });
            let account: IDBIndexedAccount | IDBAccount | undefined;
            try {
              account = await this.getIndexedAccount({ id: accountId });
            } catch (error) {
              account = await this.getAccount({ accountId });
            }
            if (wallet && account) {
              result.push({
                walletName: wallet.name,
                accountName: account.name,
              });
            }
          } catch (error) {
            //
            (error as Error).$$autoPrintErrorIgnore = true;
          }
        }
        return result;
      }
      return [];
    } catch (error) {
      (error as Error).$$autoPrintErrorIgnore = true;
      return [];
    }
  }

  async saveAccountAddresses({
    networkId,
    account,
  }: {
    networkId: string;
    account: INetworkAccount;
  }) {
    const accountId = account.id;
    const { indexedAccountId, address, addressDetail, type } = account;
    let id = `${networkId}--${address}`;
    if (type === EDBAccountType.SIMPLE) {
      const impl = networkUtils.getNetworkImpl({ networkId });
      id = `${impl}--${addressDetail.normalizedAddress}`;
    }
    const walletId = accountUtils.getWalletIdFromAccountId({
      accountId,
    });
    const db = await this.readyDb;
    await db.withTransaction(async (tx) => {
      let recordPair:
        | ILocalDBTxGetRecordByIdResult<ELocalDBStoreNames.Address>
        | undefined;
      try {
        recordPair = await db.txGetRecordById({
          tx,
          name: ELocalDBStoreNames.Address,
          id,
        });
      } catch (error) {
        //
      }
      const record = recordPair?.[0];
      if (record && recordPair) {
        await this.txUpdateRecords({
          tx,
          name: ELocalDBStoreNames.Address,
          recordPairs: [recordPair],
          updater: (r) => {
            r.wallets = r.wallets || {};
            r.wallets[walletId] = indexedAccountId ?? accountId;
            return r;
          },
        });
      } else {
        await this.txAddRecords({
          tx,
          name: ELocalDBStoreNames.Address,
          records: [
            {
              id,
              wallets: {
                [walletId]: indexedAccountId ?? accountId,
              },
            },
          ],
        });
      }
    });
  }

  getNextAccountId({
    nextAccountIds,
    key,
    defaultValue,
  }: {
    nextAccountIds: {
      [key: string]: number;
    };
    key: string;
    defaultValue: number;
  }) {
    const val = nextAccountIds[key];

    // realmDB return NaN, indexedDB return undefined
    if (Number.isNaN(val) || isNil(val)) {
      // realmDB RangeError: number is not integral
      // at BigInt (native)
      // at numToInt
      return defaultValue;
    }
    return val ?? defaultValue;
  }

  async addAccountsToWallet({
    walletId,
    accounts,
    importedCredential,
  }: {
    walletId: string;
    accounts: IDBAccount[];
    importedCredential?: ICoreImportedCredentialEncryptHex | undefined;
  }): Promise<void> {
    const db = await this.readyDb;

    this.validateAccountsFields(accounts);

    await db.withTransaction(async (tx) => {
      // TODO remove and re-add, may cause nextAccountIds not correct,
      // TODO return actual removed count
      await db.txRemoveRecords({
        tx,
        name: ELocalDBStoreNames.Account,
        ids: accounts.map((item) => item.id),
        ignoreNotFound: true,
      });

      // add account record
      const { added, addedIds } = await db.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Account,
        records: accounts,
        skipIfExists: true,
      });

      // TODO use actual added count
      // update singleton wallet.accounts & nextAccountId
      if (added > 0 && this.isSingletonWallet({ walletId })) {
        await this.txUpdateWallet({
          tx,
          walletId,
          updater: (w) => {
            w.nextAccountIds = w.nextAccountIds || {};

            w.nextAccountIds.global =
              // RealmDB return NaN, indexedDB return undefined
              // RealmDB ERROR: RangeError: number is not integral
              this.getNextAccountId({
                nextAccountIds: w.nextAccountIds,
                key: 'global',
                defaultValue: 1,
              }) + added;

            // RealmDB Error: Expected 'accounts[0]' to be a string, got an instance of List
            // w.accounts is List not Array in realmDB
            w.accounts = Array.from(w.accounts || []);

            w.accounts = uniq(
              [].concat(Array.from(w.accounts) as any, addedIds as any),
            ).filter(Boolean);

            return w;
          },
        });
      }

      if (walletId === WALLET_TYPE_IMPORTED) {
        if (addedIds.length !== 1) {
          throw new Error(
            'Only one can be imported at a time into a private key account.',
          );
        }
        if (!importedCredential) {
          throw new Error(
            'importedCredential is required for imported account',
          );
        }
        await this.txAddRecords({
          tx,
          name: ELocalDBStoreNames.Credential,
          records: [
            {
              id: addedIds[0],
              credential: importedCredential,
            },
          ],
          skipIfExists: true,
        });
      }

      // TODO should add accountId to wallet.accounts or wallet.indexedAccounts?
    });
  }

  async getWalletNextAccountId({
    walletId,
    key = 'global',
  }: {
    walletId: IDBWalletId;
    key?: string | 'global';
  }) {
    const wallet = await this.getWallet({ walletId });
    return wallet.nextAccountIds[key] ?? 1;
  }

  // ---------------------------------------------- account

  async getSingletonAccountsOfWallet({
    walletId,
  }: {
    walletId: IDBWalletIdSingleton;
  }) {
    const db = await this.readyDb;
    const wallet = await this.getWallet({ walletId });
    const { records: accounts } = await db.getAllRecords({
      name: ELocalDBStoreNames.Account,
      ids: wallet.accounts, // filter by ids for better performance
    });
    return {
      accounts: accounts
        .filter(Boolean)
        .map((account) => this.refillAccountInfo({ account })),
    };
  }

  async getAccount({ accountId }: { accountId: string }): Promise<IDBAccount> {
    const db = await this.readyDb;
    const account = await db.getRecordById({
      name: ELocalDBStoreNames.Account,
      id: accountId,
    });
    const indexedAccount = await this.getIndexedAccountByAccount({
      account,
    });
    // fix account name by indexedAccount name
    if (indexedAccount) {
      account.name = indexedAccount.name;
    }
    return this.refillAccountInfo({ account });
  }

  refillAccountInfo({ account }: { account: IDBAccount }) {
    const externalAccount = account as IDBExternalAccount;
    if (externalAccount && externalAccount.connectionInfoRaw) {
      externalAccount.connectionInfo = JSON.parse(
        externalAccount.connectionInfoRaw,
      );
    }
    return account;
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

  async removeAccount({
    accountId,
    walletId,
  }: {
    accountId: string;
    walletId: string;
  }): Promise<void> {
    const db = await this.readyDb;
    await db.withTransaction(async (tx) => {
      await this.txRemoveRecords({
        tx,
        name: ELocalDBStoreNames.Account,
        ids: [accountId],
      });
      await this.txUpdateWallet({
        tx,
        walletId,
        updater(item) {
          item.accounts = (item.accounts || ([] as string[])).filter(
            (id) => id !== accountId,
          );
          return item;
        },
      });
      if (
        accountUtils.isImportedWallet({
          walletId,
        })
      ) {
        await this.txRemoveRecords({
          tx,
          name: ELocalDBStoreNames.Credential,
          ids: [accountId],
        });
      }
    });
  }

  // TODO remove associated account
  async removeIndexedAccount({
    indexedAccountId,
    walletId,
  }: {
    indexedAccountId: string;
    walletId: string;
  }) {
    const db = await this.readyDb;
    await db.withTransaction(async (tx) => {
      await this.txRemoveRecords({
        tx,
        name: ELocalDBStoreNames.IndexedAccount,
        ids: [indexedAccountId],
      });
    });
  }

  async updateExternalAccount({
    accountId,
    addressMap,
    selectedMap,
    networkIds,
    createAtNetwork,
  }: {
    accountId: string;
    addressMap?: {
      [networkId: string]: string; // multiple address join(',')
    };
    selectedMap?: {
      [networkId: string]: number;
    };
    networkIds?: string[];
    createAtNetwork?: string;
  }) {
    const db = await this.readyDb;
    await db.withTransaction(async (tx) => {
      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Account,
        ids: [accountId],
        updater: (item) => {
          const updatedAccount = item as IDBExternalAccount;
          if (addressMap) {
            updatedAccount.connectedAddresses = addressMap;
          }
          if (selectedMap) {
            updatedAccount.selectedAddress = selectedMap;
          }
          if (networkIds) {
            updatedAccount.networks = networkIds;
          }
          if (createAtNetwork) {
            updatedAccount.createAtNetwork = createAtNetwork;
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return updatedAccount as any;
        },
      });
    });
  }

  async setAccountName(params: IDBSetAccountNameParams): Promise<void> {
    const db = await this.readyDb;

    await db.withTransaction(async (tx) => {
      if (params.indexedAccountId) {
        await this.txUpdateRecords({
          tx,
          name: ELocalDBStoreNames.IndexedAccount,
          ids: [params.indexedAccountId],
          updater: (r) => {
            if (params.name) {
              r.name = params.name || r.name;
            }
            return r;
          },
        });
      }
      if (params.accountId) {
        await this.txUpdateRecords({
          tx,
          name: ELocalDBStoreNames.Account,
          ids: [params.accountId],
          updater: (r) => {
            if (params.name) {
              r.name = params.name || r.name;
            }
            return r;
          },
        });
      }
    });
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

  async getAllDevices(): Promise<IDBDevice[]> {
    // TODO performance
    const { records: devices } = await this.getAllRecords({
      name: ELocalDBStoreNames.Device,
    });
    return devices;
  }

  async getExistingDevice({
    rawDeviceId,
    uuid,
  }: {
    rawDeviceId: string;
    uuid: string;
  }): Promise<IDBDevice | undefined> {
    const devices = await this.getAllDevices();
    return devices.find(
      (item) => item.deviceId === rawDeviceId && item.uuid === uuid,
    );
  }

  async getWalletDevice({
    walletId,
  }: {
    walletId: string;
  }): Promise<IDBDevice> {
    const wallet = await this.getWallet({
      walletId,
    });
    if (wallet.associatedDevice) {
      return this.getDevice(wallet.associatedDevice);
    }
    throw new Error('wallet associatedDevice not found');
  }

  async getDeviceByConnectId({ connectId }: { connectId: string }) {
    const devices = await this.getAllDevices();
    const device = devices.find((item) => item.connectId === connectId);
    return device ? this.refillDeviceInfo({ device }) : undefined;
  }

  async getDevice(dbDeviceId: string): Promise<IDBDevice> {
    const device = await this.getRecordById({
      name: ELocalDBStoreNames.Device,
      id: dbDeviceId,
    });
    return this.refillDeviceInfo({ device });
  }

  refillDeviceInfo({ device }: { device: IDBDevice }) {
    device.featuresInfo = JSON.parse(device.features || '{}');
    device.settings = JSON.parse(device.settingsRaw || '{}');
    return device;
  }

  async updateDeviceDbSettings({
    dbDeviceId,
    settings,
  }: IDBUpdateDeviceSettingsParams): Promise<void> {
    const db = await this.readyDb;
    await db.withTransaction(async (tx) => {
      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Device,
        ids: [dbDeviceId],
        updater: (item) => {
          item.settingsRaw = JSON.stringify(settings);
          return item;
        },
      });
    });
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
