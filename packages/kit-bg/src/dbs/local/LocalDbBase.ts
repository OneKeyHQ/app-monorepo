/* eslint-disable @typescript-eslint/no-unused-vars */
// eslint-disable-next-line max-classes-per-file

import { isEmpty, isNil, map, merge, uniq, uniqBy } from 'lodash';
import natsort from 'natsort';

import type { IBip39RevealableSeed } from '@onekeyhq/core/src/secret';
import {
  decryptImportedCredential,
  decryptRevealableSeed,
  decryptVerifyString,
  encryptImportedCredential,
  encryptRevealableSeed,
  encryptVerifyString,
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
  WALLET_TYPE_QR,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import {
  NotImplemented,
  OneKeyInternalError,
  PasswordNotSet,
  WrongPassword,
} from '@onekeyhq/shared/src/errors';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type { IAvatarInfo } from '@onekeyhq/shared/src/utils/emojiUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  INetworkAccount,
  IQrWalletAirGapAccountsInfo,
} from '@onekeyhq/shared/types/account';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types/device';
import type {
  ICreateConnectedSiteParams,
  ICreateSignedMessageParams,
  ICreateSignedTransactionParams,
} from '@onekeyhq/shared/types/signatureRecord';

import { EDBAccountType } from './consts';
import { LocalDbBaseContainer } from './LocalDbBaseContainer';
import { ELocalDBStoreNames } from './localDBStoreNames';

import type { IDeviceType } from '@onekeyfe/hd-core';
import type {
  IDBAccount,
  IDBApiGetContextOptions,
  IDBContext,
  IDBCreateHDWalletParams,
  IDBCreateHwWalletParams,
  IDBCreateQRWalletParams,
  IDBCredentialBase,
  IDBDevice,
  IDBDeviceSettings,
  IDBExternalAccount,
  IDBGetWalletsParams,
  IDBIndexedAccount,
  IDBRemoveWalletParams,
  IDBSetAccountNameParams,
  IDBSetWalletNameAndAvatarParams,
  IDBUpdateDeviceSettingsParams,
  IDBUpdateFirmwareVerifiedParams,
  IDBWallet,
  IDBWalletId,
  IDBWalletIdSingleton,
  IDBWalletNextIdKeys,
  IDBWalletNextIds,
  ILocalDBRecordUpdater,
  ILocalDBTransaction,
  ILocalDBTxGetRecordByIdResult,
} from './types';

export abstract class LocalDbBase extends LocalDbBaseContainer {
  tempWallets: {
    [walletId: string]: boolean;
  } = {};

  buildSingletonWalletRecord({ walletId }: { walletId: IDBWalletIdSingleton }) {
    const walletConfig: Record<
      IDBWalletIdSingleton,
      {
        avatar: IAvatarInfo;
        walletNo: number;
      }
    > = {
      [WALLET_TYPE_IMPORTED]: {
        avatar: {
          img: 'othersImported',
        },
        walletNo: 100_000_1,
      },
      [WALLET_TYPE_WATCHING]: {
        avatar: {
          img: 'othersWatching',
        },
        walletNo: 100_000_2,
      },
      [WALLET_TYPE_EXTERNAL]: {
        avatar: {
          img: 'othersExternal',
        },
        walletNo: 100_000_3,
      },
    };
    const record: IDBWallet = {
      id: walletId,
      avatar: walletConfig?.[walletId]?.avatar
        ? JSON.stringify(walletConfig[walletId].avatar)
        : undefined,
      name: walletId,
      type: walletId,
      backuped: true,
      accounts: [],
      walletNo: walletConfig?.[walletId]?.walletNo ?? 0,
      nextIds: {
        'hiddenWalletNum': 1,
        'accountGlobalNum': 1,
        'accountHdIndex': 0,
      },
    };
    return record;
  }

  confirmHDWalletBackuped(walletId: string): Promise<IDBWallet> {
    throw new NotImplemented();
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
        decryptVerifyString({
          password,
          verifyString: context.verifyString,
        }) === DEFAULT_VERIFY_STRING
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

  async updateContextVerifyString({ verifyString }: { verifyString: string }) {
    const db = await this.readyDb;
    await db.withTransaction(async (tx) => {
      await this.txUpdateContextVerifyString({
        tx,
        verifyString,
      });
    });
  }

  async txUpdateContextVerifyString({
    tx,
    verifyString,
  }: {
    tx: ILocalDBTransaction;
    verifyString: string;
  }) {
    await this.txUpdateContext({
      tx,
      updater: (record) => {
        record.verifyString = verifyString;
        return record;
      },
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
      await this.txUpdateContextVerifyString({
        tx,
        verifyString: encryptVerifyString({ password: newPassword }),
      });
    });
  }

  async getCredentials(): Promise<IDBCredentialBase[]> {
    const db = await this.readyDb;
    const { records: credentials } = await db.getAllRecords({
      name: ELocalDBStoreNames.Credential,
    });
    return credentials;
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

  walletSortFn = (a: IDBWallet, b: IDBWallet) =>
    (a.walletOrder ?? 0) - (b.walletOrder ?? 0);

  async getAllWallets(): Promise<{
    wallets: IDBWallet[];
  }> {
    const db = await this.readyDb;
    const { records } = await db.getAllRecords({
      name: ELocalDBStoreNames.Wallet,
    });
    return {
      wallets: records,
    };
  }

  // eslint-disable-next-line spellcheck/spell-checker
  /**
   * Get wallets
   * @param includeAllPassphraseWallet Whether to load the hidden Passphrase wallet
   * @param displayPassphraseWalletIds Need to display Passphrase wallet
   */
  async getWallets(
    option?: IDBGetWalletsParams,
  ): Promise<{ wallets: IDBWallet[] }> {
    const nestedHiddenWallets = option?.nestedHiddenWallets;
    const ignoreEmptySingletonWalletAccounts =
      option?.ignoreEmptySingletonWalletAccounts;
    const db = await this.readyDb;

    // get all wallets for account selector
    let { wallets } = await this.getAllWallets();
    const hiddenWalletsMap: {
      [dbDeviceId: string]: IDBWallet[];
    } = {};
    wallets = wallets.filter((wallet) => {
      if (this.isTempWalletRemoved({ wallet })) {
        return false;
      }
      if (
        ignoreEmptySingletonWalletAccounts &&
        accountUtils.isOthersWallet({ walletId: wallet.id })
      ) {
        if (!wallet.accounts?.length) {
          return false;
        }
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
    wallets = await Promise.all(
      wallets.map((w) =>
        this.refillWalletInfo({
          wallet: w,
          hiddenWallets: w.associatedDevice
            ? hiddenWalletsMap[w.associatedDevice]
            : undefined,
        }),
      ),
    );
    wallets = wallets.sort(this.walletSortFn);

    return {
      wallets,
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

  async getParentWalletOfHiddenWallet({
    dbDeviceId,
    isQr,
  }: {
    dbDeviceId: string;
    isQr: boolean;
  }) {
    const db = await this.readyDb;
    let parentWalletId = accountUtils.buildHwWalletId({
      dbDeviceId,
    });
    if (isQr) {
      parentWalletId = accountUtils.buildQrWalletId({
        dbDeviceId,
        xfpHash: '',
      });
    }
    const parentWallet = await db.getRecordById({
      name: ELocalDBStoreNames.Wallet,
      id: parentWalletId,
    });
    return parentWallet;
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
      const parentWallet = await this.getParentWalletOfHiddenWallet({
        dbDeviceId: wallet.associatedDevice || '',
        isQr: accountUtils.isQrWallet({ walletId: wallet.id }), // wallet.type === WALLET_TYPE_QR
      });
      wallet.walletOrder = parentWallet.walletNo + wallet.walletNo / 1000000;
    }

    if (hiddenWallets && hiddenWallets.length > 0) {
      wallet.hiddenWallets = await Promise.all(
        hiddenWallets.map((item) => this.refillWalletInfo({ wallet: item })),
      );
      wallet.hiddenWallets = wallet.hiddenWallets.sort(this.walletSortFn);
    }

    if (
      accountUtils.isOthersWallet({
        walletId: wallet.id,
      })
    ) {
      if (accountUtils.isWatchingWallet({ walletId: wallet.id })) {
        wallet.name = appLocale.intl.formatMessage({
          id: ETranslations.global_watched,
        });
      }
      if (accountUtils.isExternalWallet({ walletId: wallet.id })) {
        wallet.name = appLocale.intl.formatMessage({
          id: ETranslations.global_connected_account,
        });
      }
      if (accountUtils.isImportedWallet({ walletId: wallet.id })) {
        wallet.name = appLocale.intl.formatMessage({
          id: ETranslations.global_private_key,
        });
      }
    }

    if (wallet.airGapAccountsInfoRaw) {
      wallet.airGapAccountsInfo = JSON.parse(wallet.airGapAccountsInfoRaw);
    }

    // wallet.xfp = 'aaaaaaaa'; // mock qr wallet xfp
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
      accountUtils.isQrAccount({ accountId }) ||
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
    return db.withTransaction(async (tx) =>
      this.txAddIndexedAccount({
        tx,
        walletId,
        skipIfExists,
        indexes,
      }),
    );
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
      !accountUtils.isQrWallet({ walletId }) &&
      !accountUtils.isHwWallet({ walletId })
    ) {
      throw new OneKeyInternalError({
        message: `addIndexedAccount ERROR: only hd or hw wallet support "${walletId}"`,
      });
    }
    let dbDevice: IDBDevice | undefined;
    let dbWallet: IDBWallet | undefined;
    if (
      accountUtils.isHwWallet({ walletId }) ||
      accountUtils.isQrWallet({ walletId })
    ) {
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
        name: accountUtils.buildIndexedAccountName({
          pathIndex: index,
        }),
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
    return records;
    // const [wallet] = await this.txGetWallet({
    //   tx,
    //   walletId,
    // });
    // const nextIndex = this.getWalletNextAccountId({
    //   wallet,
    //   key: 'index',
    //   defaultValue: 0,
    // });
    // const maxIndex = max(indexes);
    // if (!isNil(maxIndex) && maxIndex >= nextIndex) {
    //   await this.txUpdateWallet({
    //     tx,
    //     walletId,
    //     updater: (w) => {
    //       return w;
    //     },
    //   });
    // }
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
    let nextIndex = this.getNextIdsValue({
      nextIds: wallet.nextIds,
      key: 'accountHdIndex',
      defaultValue: 0,
    });

    let maxLoop = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const indexedAccountId = accountUtils.buildIndexedAccountId({
        walletId,
        index: nextIndex,
      });
      try {
        const result = await this.txGetRecordById({
          tx,
          name: ELocalDBStoreNames.IndexedAccount,
          id: indexedAccountId,
        });
        const indexedAccount = result?.[0];
        if (!indexedAccount || !result) {
          break;
        }
      } catch (error) {
        break;
      }
      if (maxLoop >= 1000) {
        break;
      }
      nextIndex += 1;
      maxLoop += 1;
    }

    if (onlyAddFirst) {
      nextIndex = 0;
    }

    await this.txAddIndexedAccount({
      tx,
      walletId,
      indexes: [nextIndex],
      skipIfExists: true,
    });

    await this.txUpdateWallet({
      tx,
      walletId,
      updater: (w) => {
        // DO NOT use  w.nextIds = w.nextIds || {};
        // it will reset nextIds to {}
        if (!w.nextIds) {
          w.nextIds = {};
        }
        w.nextIds.accountHdIndex = nextIndex + 1;
        return w;
      },
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
    if (
      accountUtils.isHwWallet({ walletId }) ||
      accountUtils.isQrWallet({ walletId })
    ) {
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
    const { password, name, avatar, backuped, rs, walletHash } = params;
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
            hash: walletHash || undefined,
            avatar: avatar && JSON.stringify(avatar), // TODO save object to realmDB?
            type: WALLET_TYPE_HD,
            backuped,
            nextIds: {
              accountHdIndex: firstAccountIndex,
            },
            accounts: [],
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
        updater: async (item) => {
          if (verifyResult === 'official') {
            const versionText = await deviceUtils.getDeviceVersionStr({
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

  async updateDevice({ features }: { features: IOneKeyDeviceFeatures }) {
    const device = await this.getDeviceByQuery({
      features,
    });
    if (!device) {
      return;
    }
    const db = await this.readyDb;
    await db.withTransaction(async (tx) => {
      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Device,
        ids: [device.id],
        updater: async (item) => {
          item.features = JSON.stringify(features);
          return item;
        },
      });
    });
  }

  async createQrWallet({ qrDevice, airGapAccounts }: IDBCreateQRWalletParams) {
    const db = await this.readyDb;
    const { deviceId: rawDeviceId, xfp } = qrDevice;
    const existingDevice = await this.getDeviceByQuery({
      featuresDeviceId: rawDeviceId,
    });
    const dbDeviceId = existingDevice?.id || accountUtils.buildDeviceDbId();

    let passphraseState = '';
    let xfpHash = '';

    // TODO support OneKey Pro device only
    const deviceType: IDeviceType = 'pro';
    // TODO name should be OneKey Pro-xxxxxx
    let deviceName = qrDevice.name || 'OneKey Pro';
    const nameArr = deviceName.split('-');
    if (nameArr.length >= 2) {
      const lastHash = nameArr[nameArr.length - 1];
      if (lastHash.length === 8) {
        // hidden wallet
        passphraseState = lastHash;
        deviceName = nameArr.slice(0, nameArr.length - 1).join('');
      }
    }

    if (passphraseState || qrDevice.buildBy === 'hdkey') {
      xfpHash = bufferUtils.bytesToHex(
        sha256(bufferUtils.toBuffer(xfp, 'utf8')),
      );
    }
    const walletName = deviceName;
    const now = Date.now();

    const avatar: IAvatarInfo = {
      img: deviceType,
    };
    const context = await this.getContext();

    const dbWalletId = accountUtils.buildQrWalletId({
      dbDeviceId,
      xfpHash,
    });

    // TODO parse passphraseState from deviceName
    // const passphraseState = deviceName;

    const firstAccountIndex = 0;
    let addedHdAccountIndex = -1;

    await db.withTransaction(async (tx) => {
      if (existingDevice) {
        await this.txUpdateRecords({
          tx,
          name: ELocalDBStoreNames.Device,
          ids: [dbDeviceId],
          updater: async (item) => {
            item.updatedAt = now;
            // TODO update qrDevice last version(not updated version)
            return item;
          },
        });
      } else {
        await this.txAddDbDevice({
          tx,
          skipIfExists: true,
          device: {
            id: dbDeviceId,
            name: deviceName,
            connectId: '',
            uuid: '',
            deviceId: rawDeviceId,
            deviceType,
            // TODO save qrDevice last version(not updated version)
            features: '',
            settingsRaw: '',
            createdAt: now,
            updatedAt: now,
          },
        });

        await this.txUpdateRecords({
          tx,
          name: ELocalDBStoreNames.Device,
          ids: [dbDeviceId],
          updater: async (item) => {
            item.updatedAt = now;
            return item;
          },
        });
      }

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
            type: WALLET_TYPE_QR,
            backuped: true,
            associatedDevice: dbDeviceId,
            isTemp: false,
            passphraseState,
            nextIds: {
              accountHdIndex: firstAccountIndex,
            },
            accounts: [],
            walletNo: context.nextWalletNo,
            xfp,
          },
        ],
      });

      await this.txUpdateWallet({
        tx,
        walletId: dbWalletId,
        updater: (item) => {
          item.isTemp = false;
          item.xfp = xfp;

          let currentAirGapAccountsInfo:
            | IQrWalletAirGapAccountsInfo
            | undefined;
          if (item.airGapAccountsInfoRaw) {
            try {
              currentAirGapAccountsInfo = JSON.parse(
                item.airGapAccountsInfoRaw,
              );
            } catch (error) {
              //
            }
          }

          const accountsMerged = uniqBy(
            [
              ...(currentAirGapAccountsInfo?.accounts || []),
              ...(airGapAccounts || []),
            ],
            (a) => a.path + a.chain,
          );
          const keysInfo: IQrWalletAirGapAccountsInfo = {
            accounts: accountsMerged || [],
          };
          item.airGapAccountsInfoRaw = JSON.stringify(keysInfo);
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

    // if (passphraseState) {
    // this.tempWallets[dbWalletId] = true;
    // }

    return this.buildCreateHDAndHWWalletResult({
      walletId: dbWalletId,
      addedHdAccountIndex,
    });
  }

  async addDbDevice({
    device,
    skipIfExists,
  }: {
    device: IDBDevice;
    skipIfExists?: boolean;
  }) {
    const db = await this.readyDb;
    return db.withTransaction(async (tx) =>
      this.txAddDbDevice({
        tx,
        device,
        skipIfExists,
      }),
    );
  }

  async txAddDbDevice({
    tx,
    device,
    skipIfExists,
  }: {
    tx: ILocalDBTransaction;
    device: IDBDevice;
    skipIfExists?: boolean;
  }) {
    return this.txAddRecords({
      tx,
      name: ELocalDBStoreNames.Device,
      skipIfExists,
      records: [device],
    });
  }

  async buildHwWalletId(params: IDBCreateHwWalletParams) {
    const { getDeviceType, getDeviceUUID } = await CoreSDKLoader();

    const { name, device, features, passphraseState, isFirmwareVerified } =
      params;
    const deviceUUID = device.uuid || getDeviceUUID(features);
    const rawDeviceId = device.deviceId || features.device_id || '';
    const existingDevice = await this.getExistingDevice({
      rawDeviceId,
      uuid: deviceUUID,
    });
    const dbDeviceId = existingDevice?.id || accountUtils.buildDeviceDbId();
    const dbWalletId = accountUtils.buildHwWalletId({
      dbDeviceId,
      passphraseState,
    });

    return {
      dbDeviceId,
      dbWalletId,
      deviceUUID,
      rawDeviceId,
    };
  }

  async restoreTempCreatedWallet({ walletId }: { walletId: string }) {
    const db = await this.readyDb;
    await db.withTransaction(async (tx) => {
      await this.txUpdateWallet({
        tx,
        walletId,
        updater: (item) => {
          item.isTemp = false;
          return item;
        },
      });
    });
  }

  // TODO remove unused hidden wallet first
  async createHwWallet(params: IDBCreateHwWalletParams) {
    const db = await this.readyDb;
    const {
      name,
      device,
      features,
      passphraseState,
      isFirmwareVerified,
      defaultIsTemp,
    } = params;
    console.log('createHwWallet', features);
    // TODO check features if exists
    const { getDeviceType, getDeviceUUID } = await CoreSDKLoader();
    const { connectId } = device;
    if (!connectId) {
      throw new Error('createHwWallet ERROR: connectId is required');
    }
    const context = await this.getContext();
    // const serialNo = features.onekey_serial ?? features.serial_no ?? '';
    const deviceType = device.deviceType || getDeviceType(features);
    const avatar: IAvatarInfo = {
      img: deviceType,
    };

    const { dbDeviceId, dbWalletId, deviceUUID, rawDeviceId } =
      await this.buildHwWalletId(params);

    let parentWalletId: string | undefined;
    const deviceName = await accountUtils.buildDeviceName({ device, features });
    let walletName = name || deviceName;
    if (passphraseState) {
      const parentWallet = await this.getParentWalletOfHiddenWallet({
        dbDeviceId,
        isQr: accountUtils.isQrWallet({ walletId: dbWalletId }),
      });
      parentWalletId = parentWallet.id;
      walletName =
        name || `Hidden Wallet #${parentWallet?.nextIds?.hiddenWalletNum || 1}`;
    }

    const featuresStr = JSON.stringify(features);

    const firstAccountIndex = 0;

    let addedHdAccountIndex = -1;

    await db.withTransaction(async (tx) => {
      // add db device
      const now = Date.now();
      await this.txAddDbDevice({
        tx,
        skipIfExists: true,
        device: {
          id: dbDeviceId,
          name: deviceName,
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
      });

      // update exists db device
      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Device,
        ids: [dbDeviceId],
        updater: async (item) => {
          item.features = featuresStr;
          item.updatedAt = now;

          item.connectId = connectId || '';
          item.uuid = deviceUUID;
          item.deviceId = rawDeviceId;
          item.deviceType = deviceType;

          item.settingsRaw =
            item.settingsRaw ||
            JSON.stringify({
              inputPinOnSoftware: true,
            } as IDBDeviceSettings);

          if (isFirmwareVerified) {
            const versionText = await deviceUtils.getDeviceVersionStr({
              device,
              features,
            });
            // official firmware verified
            item.verifiedAtVersion = versionText;
          } else {
            // skip firmware verify, but keep previous verified version
            item.verifiedAtVersion = item.verifiedAtVersion || undefined;
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
            isTemp: defaultIsTemp ?? false,
            passphraseState,
            nextIds: {
              accountHdIndex: firstAccountIndex,
            },
            accounts: [],
            walletNo: context.nextWalletNo,
          },
        ],
      });

      await this.txUpdateWallet({
        tx,
        walletId: dbWalletId,
        updater: (item) => {
          if (passphraseState) {
            item.isTemp = false;
          } else {
            item.isTemp = defaultIsTemp ?? false;
          }
          return item;
        },
      });

      if (passphraseState && parentWalletId) {
        await this.txUpdateWallet({
          tx,
          walletId: parentWalletId,
          updater: (item) => {
            // DO NOT use  w.nextIds = w.nextIds || {};
            // it will reset nextIds to {}
            if (!item.nextIds) {
              item.nextIds = {};
            }

            item.nextIds.hiddenWalletNum =
              (item.nextIds.hiddenWalletNum || 1) + 1;
            return item;
          },
        });
      }

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

  async clearQrWalletAirGapAccountKeys({ walletId }: { walletId: string }) {
    const db = await this.readyDb;
    await db.withTransaction(async (tx) => {
      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Wallet,
        ids: [walletId],
        updater: (item) => {
          item.airGapAccountsInfoRaw = undefined;
          return item;
        },
      });
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
      const isHardware =
        accountUtils.isHwWallet({
          walletId,
        }) || accountUtils.isQrWallet({ walletId });
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
    hideImmediately,
  }: {
    walletId: IDBWalletId;
    isTemp: boolean;
    hideImmediately?: boolean;
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
      if (hideImmediately) {
        delete this.tempWallets[walletId];
      } else {
        this.tempWallets[walletId] = true;
      }
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
      // **** do NOT update device name, qr wallet use device name to check sign origin
      // if (wallet.associatedDevice) {
      //   await this.txUpdateRecords({
      //     tx,
      //     name: ELocalDBStoreNames.Device,
      //     ids: [wallet.associatedDevice],
      //     updater: (item) => {
      //       if (params.name) {
      //         item.name = params.name || item.name;
      //       }
      //       return item;
      //     },
      //   });
      // }
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

  async getAddressByNetworkId({
    networkId,
    address,
  }: {
    networkId: string;
    address: string;
  }) {
    try {
      const id = `${networkId}--${address}`;
      return await this.getRecordById({
        name: ELocalDBStoreNames.Address,
        id,
      });
    } catch (error) {
      return null;
    }
  }

  async getAddressByNetworkImpl({
    networkId,
    normalizedAddress,
  }: {
    networkId: string;
    normalizedAddress: string;
  }) {
    try {
      const impl = networkUtils.getNetworkImpl({ networkId });
      const id = `${impl}--${normalizedAddress}`;
      return await this.getRecordById({
        name: ELocalDBStoreNames.Address,
        id,
      });
    } catch (error) {
      return null;
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
  }): Promise<
    Array<{ walletName: string; accountName: string; accountId: string }>
  > {
    try {
      const db = await this.readyDb;

      const info = (
        await Promise.all([
          this.getAddressByNetworkId({ networkId, address }),
          this.getAddressByNetworkImpl({ networkId, normalizedAddress }),
        ])
      ).filter(Boolean);

      if (!isEmpty(info)) {
        const result = [];
        const wallets = map(info, 'wallets');
        const items = Object.entries(merge({}, wallets[0], wallets[1]));
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
                accountId: account.id,
              });
            }
          } catch (error) {
            errorUtils.autoPrintErrorIgnore(error);
          }
        }
        return result;
      }
      return [];
    } catch (error) {
      errorUtils.autoPrintErrorIgnore(error);
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
    let id = address ? `${networkId}--${address}` : '';
    if (type === EDBAccountType.SIMPLE) {
      const impl = networkUtils.getNetworkImpl({ networkId });
      id = addressDetail?.normalizedAddress
        ? `${impl}--${addressDetail?.normalizedAddress}`
        : '';
    }
    if (!id) {
      return;
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
            // DO NOT use              r.wallets = r.wallets || {};
            // it will reset nextIds to {}
            if (!r.wallets) {
              r.wallets = {};
            }

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

  getNextIdsValue({
    nextIds,
    key,
    defaultValue,
  }: {
    nextIds: IDBWalletNextIds | Realm.Dictionary<number> | undefined;
    key: IDBWalletNextIdKeys;
    defaultValue: number;
  }) {
    const val = nextIds?.[key];

    // RealmDB ERROR: RangeError: number is not integral
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
    allAccountsBelongToNetworkId,
    walletId,
    accounts,
    importedCredential,
    accountNameBuilder,
  }: {
    allAccountsBelongToNetworkId?: string; // pass this only if all accounts belong to the same network
    walletId: string;
    accounts: IDBAccount[];
    importedCredential?: ICoreImportedCredentialEncryptHex | undefined;
    // accountNameBuilder for watching, imported, external account
    accountNameBuilder?: (data: { nextAccountId: number }) => string;
  }): Promise<void> {
    const db = await this.readyDb;

    this.validateAccountsFields(accounts);

    const wallet = await this.getWallet({ walletId });
    let nextAccountId: number = this.getNextIdsValue({
      nextIds: wallet.nextIds,
      key: 'accountGlobalNum',
      defaultValue: 1,
    });

    await db.withTransaction(async (tx) => {
      const ids = accounts.map((item) => item.id);
      let { records: existsAccounts = [] } = await db.txGetAllRecords({
        tx,
        name: ELocalDBStoreNames.Account,
        ids,
      });

      existsAccounts = existsAccounts.filter(Boolean);

      let removed = 0;
      if (existsAccounts && existsAccounts.length) {
        // TODO remove and re-add, may cause nextIds not correct,
        // TODO return actual removed count
        await db.txRemoveRecords({
          tx,
          name: ELocalDBStoreNames.Account,
          ids,
          ignoreNotFound: true,
        });

        removed = existsAccounts.length;
      }

      // fix account name
      accounts.forEach((account) => {
        if (!account.name) {
          // keep exists account name
          const existsAccount = existsAccounts.find(
            (item) => item.id === account.id,
          );
          if (existsAccount) {
            account.name = existsAccount?.name || account.name;
          }
        }
        if (!account.name && accountNameBuilder) {
          // auto create account name here
          account.name = accountNameBuilder({
            nextAccountId,
          });
          nextAccountId += 1;
        }
      });

      // add account record
      let { added, addedIds } = await db.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Account,
        records: accounts,
        skipIfExists: true,
      });

      let actualAdded = added - removed;

      // filter out url account
      const allAddedIds = addedIds;
      addedIds = addedIds.filter(
        (id) => !accountUtils.isUrlAccountFn({ accountId: id }),
      );
      const urlAccountsCount = allAddedIds.length - addedIds.length;
      actualAdded = Math.max(0, actualAdded - urlAccountsCount);

      // update singleton wallet.accounts & nextAccountId
      if (actualAdded > 0 && this.isSingletonWallet({ walletId })) {
        await this.txUpdateWallet({
          tx,
          walletId,
          updater: (w) => {
            // DO NOT use  w.nextIds = w.nextIds || {};
            // it will reset nextIds to {}
            if (!w.nextIds) {
              w.nextIds = {};
            }

            const nextIdsData = w.nextIds;
            const currentNextAccountId = this.getNextIdsValue({
              nextIds: nextIdsData,
              key: 'accountGlobalNum',
              defaultValue: 1,
            });
            const newAccountGlobalNum = currentNextAccountId + actualAdded;
            w.nextIds.accountGlobalNum = newAccountGlobalNum;

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

    if (allAccountsBelongToNetworkId) {
      for (const account of accounts) {
        try {
          await this.saveAccountAddresses({
            networkId: allAccountsBelongToNetworkId,
            account: account as any,
          });
        } catch (error) {
          //
        }
      }
    }
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
        .filter(
          (item) =>
            item && !accountUtils.isUrlAccountFn({ accountId: item.id }),
        )
        .map((account) => this.refillAccountInfo({ account })),
    };
  }

  async getAccountsInSameIndexedAccountId({
    indexedAccountId,
  }: {
    indexedAccountId: string;
  }) {
    const db = await this.readyDb;
    const { records: accounts } = await db.getAllRecords({
      name: ELocalDBStoreNames.Account,
    });
    return accounts
      .filter(
        (account) =>
          account.indexedAccountId === indexedAccountId && indexedAccountId,
      )
      .map((account) => this.refillAccountInfo({ account }));
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

  async getAccountSafe({
    accountId,
  }: {
    accountId: string;
  }): Promise<IDBAccount | undefined> {
    try {
      return await this.getAccount({ accountId });
    } catch (error) {
      return undefined;
    }
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

  async getAllAccounts() {
    const { records: accounts } = await this.getAllRecords({
      name: ELocalDBStoreNames.Account,
    });
    return { accounts };
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

  // ---------------------------------------------- device

  async getAllDevices(): Promise<{ devices: IDBDevice[] }> {
    // TODO performance
    const { records: devices } = await this.getAllRecords({
      name: ELocalDBStoreNames.Device,
    });
    devices.forEach((item) => this.refillDeviceInfo({ device: item }));
    return { devices };
  }

  async getSameDeviceByUUIDEvenIfReset(uuid: string) {
    const { devices } = await this.getAllDevices();
    return devices.find((item) => uuid && item.uuid === uuid);
  }

  async getExistingDevice({
    // required: After resetting, the device will be considered as a new one.
    //      use the getSameDeviceByUUIDEvenIfReset() method if you want to find the same device even if it is reset.
    rawDeviceId,
    uuid,
  }: {
    rawDeviceId: string;
    uuid: string;
  }): Promise<IDBDevice | undefined> {
    if (!rawDeviceId) {
      return undefined;
    }
    const { devices } = await this.getAllDevices();
    return devices.find((item) => {
      let deviceIdMatched = rawDeviceId && item.deviceId === rawDeviceId;
      if (uuid && item.uuid) {
        deviceIdMatched = deviceIdMatched && item.uuid === uuid;
      }
      return deviceIdMatched;
    });
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

  async getDeviceByQuery({
    connectId,
    featuresDeviceId,
    features,
  }: {
    connectId?: string;
    featuresDeviceId?: string;
    features?: IOneKeyDeviceFeatures;
  }): Promise<IDBDevice | undefined> {
    const { getDeviceUUID } = await CoreSDKLoader();
    const { devices } = await this.getAllDevices();
    const device = devices.find((item) => {
      let predicate: boolean | undefined;
      const mergePredicate = (p: boolean) => {
        if (isNil(predicate)) {
          predicate = p;
        } else {
          predicate = predicate && p;
        }
      };
      if (connectId) {
        mergePredicate(item.connectId === connectId);
      }
      if (featuresDeviceId) {
        mergePredicate(item.deviceId === featuresDeviceId);
      }
      if (features) {
        let uuidInDb = item.uuid;
        if (!uuidInDb) {
          uuidInDb = item.featuresInfo ? getDeviceUUID(item.featuresInfo) : '';
        }
        const uuidInQuery = features ? getDeviceUUID(features) : '';
        mergePredicate(!!uuidInDb && !!uuidInQuery && uuidInQuery === uuidInDb);
      }
      return predicate ?? false;
    });
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

  // ---------------------------------------------- signature record
  async addSignedMessage(params: ICreateSignedMessageParams) {
    const db = await this.readyDb;
    await db.withTransaction(async (tx) => {
      const [ctx] = await this.txGetContext({ tx }); // check context
      await this.txAddRecords({
        name: ELocalDBStoreNames.SignedMessage,
        tx,
        records: [
          {
            ...params,
            id: String(ctx.nextSignatureMessageId),
            createdAt: Date.now(),
          },
        ],
      });
      await this.txUpdateContext({
        tx,
        updater: (r) => {
          r.nextSignatureMessageId += 1;
          return r;
        },
      });
    });
  }

  async addSignedTransaction(params: ICreateSignedTransactionParams) {
    const db = await this.readyDb;
    const { data, ...rest } = params;
    const dataStringify = JSON.stringify(data);
    await db.withTransaction(async (tx) => {
      const [ctx] = await this.txGetContext({ tx }); // check context
      await this.txAddRecords({
        name: ELocalDBStoreNames.SignedTransaction,
        tx,
        records: [
          {
            ...rest,
            dataStringify,
            id: String(ctx.nextSignatureTransactionId),
            createdAt: Date.now(),
          },
        ],
      });
      await this.txUpdateContext({
        tx,
        updater: (r) => {
          r.nextSignatureTransactionId += 1;
          return r;
        },
      });
    });
  }

  async addConnectedSite(params: ICreateConnectedSiteParams) {
    const db = await this.readyDb;
    await db.withTransaction(async (tx) => {
      const [ctx] = await this.txGetContext({ tx }); // check context
      await this.txAddRecords({
        name: ELocalDBStoreNames.ConnectedSite,
        tx,
        records: [
          {
            ...params,
            id: String(ctx.nextConnectedSiteId),
            createdAt: Date.now(),
          },
        ],
      });
      await this.txUpdateContext({
        tx,
        updater: (r) => {
          r.nextConnectedSiteId += 1;
          return r;
        },
      });
    });
  }

  async removeAllSignedMessage() {
    const db = await this.readyDb;
    const allSignedMessage = await db.getAllRecords({
      name: ELocalDBStoreNames.SignedMessage,
    });
    await db.withTransaction(async (tx) => {
      await this.txRemoveRecords({
        name: ELocalDBStoreNames.SignedMessage,
        tx,
        ids: allSignedMessage.records.map((item) => item.id),
      });
    });
  }

  async removeAllSignedTransaction() {
    const db = await this.readyDb;
    const allSignedTransaction = await db.getAllRecords({
      name: ELocalDBStoreNames.SignedTransaction,
    });
    await db.withTransaction(async (tx) => {
      await this.txRemoveRecords({
        name: ELocalDBStoreNames.SignedTransaction,
        tx,
        ids: allSignedTransaction.records.map((item) => item.id),
      });
    });
  }

  async removeAllConnectedSite() {
    const db = await this.readyDb;
    const allConnectedSite = await db.getAllRecords({
      name: ELocalDBStoreNames.ConnectedSite,
    });
    await db.withTransaction(async (tx) => {
      await this.txRemoveRecords({
        name: ELocalDBStoreNames.ConnectedSite,
        tx,
        ids: allConnectedSite.records.map((item) => item.id),
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
