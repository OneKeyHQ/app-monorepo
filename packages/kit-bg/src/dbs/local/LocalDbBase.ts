/* eslint-disable @typescript-eslint/no-unused-vars */
import { Buffer } from 'buffer';

import { isNil, max } from 'lodash';
import natsort from 'natsort';

import {
  decrypt,
  encrypt,
  ensureSensitiveTextEncoded,
  sha256,
} from '@onekeyhq/core/src/secret';
import type { ICoreImportedCredentialEncryptHex } from '@onekeyhq/core/src/types';
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
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import {
  DB_MAIN_CONTEXT_ID,
  DEFAULT_VERIFY_STRING,
  EDBAccountType,
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from './consts';
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
  IDBDevicePayload,
  IDBIndexedAccount,
  IDBRemoveWalletParams,
  IDBSetAccountNameParams,
  IDBSetAccountTemplateParams,
  IDBSetWalletNameAndAvatarParams,
  IDBStoredPrivateKeyCredential,
  IDBStoredSeedCredential,
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

    // get all wallets for account selector
    let { records } = await db.getAllRecords({
      name: ELocalDBStoreNames.Wallet,
    });
    records = records.filter((wallet) => {
      if (this.isTempWalletRemoved({ wallet })) {
        return false;
      }
      return true;
    });
    records = await Promise.all(
      records.map((w) => this.refillWalletInfo({ wallet: w })),
    );
    records = records.sort(
      (a, b) => (a.walletOrder ?? 0) - (b.walletOrder ?? 0),
    );

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

  async refillWalletInfo({ wallet }: { wallet: IDBWallet }) {
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

  async getIndexedAccounts({ walletId }: { walletId?: string } = {}) {
    const db = await this.readyDb;
    // TODO performance
    const { records } = await db.getAllRecords({
      name: ELocalDBStoreNames.IndexedAccount,
    });
    console.log('getIndexedAccountsOfWallet', records);
    let accounts = records;
    if (walletId) {
      accounts = accounts.filter((item) => item.walletId === walletId);
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

  // TODO remove unused hidden wallet first
  async createHWWallet(params: IDBCreateHWWalletParams) {
    const db = await this.readyDb;
    const { name, device, features, passphraseState, isFirmwareVerified } =
      params;
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
            payloadJson: `{}`,
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
            const versionText = deviceUtils.getDeviceVersionStr(device);
            item.verifiedAtVersion = versionText;
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
            deviceType,
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

  async removeWallet({
    walletId,
    password,
    isHardware,
  }: IDBRemoveWalletParams): Promise<void> {
    const db = await this.readyDb;
    if (!isHardware) {
      await this.verifyPassword(password);
    }
    await db.withTransaction(async (tx) => {
      // call remove account & indexed account
      // remove credential
      // remove wallet
      // remove address

      const [wallet] = await this.txGetWallet({
        tx,
        walletId,
      });
      if (isHardware) {
        if (wallet.associatedDevice) {
          await this.txRemoveRecords({
            tx,
            name: ELocalDBStoreNames.Device,
            ids: [wallet.associatedDevice],
          });
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

        if (!account.impl) {
          throw new Error(
            'validateAccountsFields ERROR: account.impl is missing',
          );
        }

        if (account.type === EDBAccountType.VARIANT) {
          if (account.address) {
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
          }
        }
        return result;
      }
      return [];
    } catch (error) {
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
      // add account record
      const { added, addedIds } = await db.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Account,
        records: accounts,
        skipIfExists: true,
      });

      // update singleton wallet.accounts & nextAccountId
      if (added > 0 && this.isSingletonWallet({ walletId })) {
        await this.txUpdateWallet({
          tx,
          walletId,
          updater: (w) => {
            w.nextAccountIds = w.nextAccountIds || {};
            w.nextAccountIds.global = (w.nextAccountIds.global ?? 1) + added;

            w.accounts = w.accounts || [];
            w.accounts = [].concat(w.accounts as any, addedIds as any);
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
          throw new Error('importedCredential is missing');
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
      accounts,
    };
  }

  async getAccount({ accountId }: { accountId: string }): Promise<IDBAccount> {
    const db = await this.readyDb;
    const account = await db.getRecordById({
      name: ELocalDBStoreNames.Account,
      id: accountId,
    });
    if (!account.impl) {
      throw new Error(`account.impl is missing: ${accountId}`);
    }
    const indexedAccount = await this.getIndexedAccountByAccount({
      account,
    });
    // fix account name by indexedAccount name
    if (indexedAccount) {
      account.name = indexedAccount.name;
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

  removeAccount(
    walletId: string,
    accountId: string,
    password: string,
    rollbackNextAccountIds: Record<string, number>,
    skipPasswordCheck?: boolean | undefined,
  ): Promise<void> {
    throw new Error('Method not implemented.');
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

  async getDevice(deviceId: string): Promise<IDBDevice> {
    const device = await this.getRecordById({
      name: ELocalDBStoreNames.Device,
      id: deviceId,
    });
    device.featuresInfo = JSON.parse(device.features) as IOneKeyDeviceFeatures;
    device.payloadJsonInfo = JSON.parse(device.payloadJson);
    return device;
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
