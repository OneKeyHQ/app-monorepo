/* eslint-disable @typescript-eslint/no-unused-vars */
// eslint-disable-next-line max-classes-per-file

import { EDeviceType } from '@onekeyfe/hd-shared';
import {
  debounce,
  isEmpty,
  isNil,
  isPlainObject,
  isString,
  map,
  merge,
  uniq,
  uniqBy,
} from 'lodash';
import natsort from 'natsort';

import type {
  IBip39RevealableSeed,
  IBip39RevealableSeedEncryptHex,
} from '@onekeyhq/core/src/secret';
import {
  decryptHyperLiquidAgentCredential,
  decryptImportedCredential,
  decryptRevealableSeed,
  decryptVerifyString,
  encryptHyperLiquidAgentCredential,
  encryptImportedCredential,
  encryptRevealableSeed,
  encryptVerifyString,
  ensureSensitiveTextEncoded,
  sha256,
} from '@onekeyhq/core/src/secret';
import type {
  ICoreHyperLiquidAgentCredential,
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
import type { EHyperLiquidAgentName } from '@onekeyhq/shared/src/consts/perp';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import {
  COINTYPE_DNX,
  COINTYPE_ETH,
  FIRST_EVM_ADDRESS_PATH,
} from '@onekeyhq/shared/src/engine/engineConsts';
import {
  NotImplemented,
  OneKeyErrorAirGapStandardWalletRequiredWhenCreateHiddenWallet,
  OneKeyInternalError,
  OneKeyLocalError,
  PasswordNotSet,
  RenameDuplicateNameError,
  WrongPassword,
} from '@onekeyhq/shared/src/errors';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { getDeviceAvatarImage } from '@onekeyhq/shared/src/utils/avatarUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/debug/perfUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type { IAvatarInfo } from '@onekeyhq/shared/src/utils/emojiUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import type {
  INetworkAccount,
  IQrWalletAirGapAccountsInfo,
} from '@onekeyhq/shared/types/account';
import type {
  IDeviceHomeScreen,
  IDeviceVersionCacheInfo,
  IOneKeyDeviceFeatures,
} from '@onekeyhq/shared/types/device';
import type {
  ICreateConnectedSiteParams,
  ICreateSignedMessageParams,
  ICreateSignedTransactionParams,
} from '@onekeyhq/shared/types/signatureRecord';

import { EDBAccountType } from './consts';
import { LocalDbBaseContainer } from './LocalDbBaseContainer';
import { ELocalDBStoreNames } from './localDBStoreNames';
import { EIndexedDBBucketNames } from './types';

import type { RealmSchemaCloudSyncItem } from './realm/schemas/RealmSchemaCloudSyncItem';
import type {
  IDBAccount,
  IDBApiGetContextOptions,
  IDBCloudSyncItem,
  IDBContext,
  IDBCreateHDWalletParams,
  IDBCreateHwWalletParams,
  IDBCreateQRWalletParams,
  IDBCredentialBase,
  IDBDevice,
  IDBDeviceSettings,
  IDBEnsureAccountNameNotDuplicateParams,
  IDBExternalAccount,
  IDBGetWalletsParams,
  IDBIndexedAccount,
  IDBRemoveWalletParams,
  IDBSetAccountNameParams,
  IDBSetWalletNameAndAvatarParams,
  IDBUpdateDeviceSettingsParams,
  IDBUpdateFirmwareVerifiedParams,
  IDBVariantAccount,
  IDBWallet,
  IDBWalletId,
  IDBWalletIdSingleton,
  IDBWalletNextIdKeys,
  IDBWalletNextIds,
  IDBWalletType,
  ILocalDBRecordUpdater,
  ILocalDBTransaction,
  ILocalDBTxGetRecordByIdResult,
} from './types';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDeviceType } from '@onekeyfe/hd-core';

const getOrderByWalletType = (walletType: IDBWalletType): number => {
  switch (walletType) {
    case WALLET_TYPE_HW:
      return 1;
    case WALLET_TYPE_QR:
      return 2;
    case WALLET_TYPE_HD:
      return 3;
    case WALLET_TYPE_IMPORTED:
      return 4;
    case WALLET_TYPE_EXTERNAL:
      return 5;
    case WALLET_TYPE_WATCHING:
      return 6;
    default:
      return 0;
  }
};

export abstract class LocalDbBase extends LocalDbBaseContainer {
  tempWallets: {
    [walletId: string]: boolean;
  } = {};

  backgroundApi!: IBackgroundApi;

  setBackgroundApi(backgroundApi: IBackgroundApi) {
    this.backgroundApi = backgroundApi;
  }

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
        walletNo: 1_000_001,
      },
      [WALLET_TYPE_WATCHING]: {
        avatar: {
          img: 'othersWatching',
        },
        walletNo: 1_000_002,
      },
      [WALLET_TYPE_EXTERNAL]: {
        avatar: {
          img: 'othersExternal',
        },
        walletNo: 1_000_003,
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
      deprecated: false,
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
      throw new OneKeyLocalError('failed get local db context');
    }

    if (options?.verifyPassword) {
      const { verifyPassword } = options;
      ensureSensitiveTextEncoded(verifyPassword);
      if (
        !(await this.checkPassword({ context: ctx, password: verifyPassword }))
      ) {
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
    await this.txUpdateRecords({
      name: ELocalDBStoreNames.Context,
      ids: [DB_MAIN_CONTEXT_ID],
      tx,
      updater,
    });
  }

  async resetContext() {
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
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
    const context = await this.getContext();
    const { backupUUID } = context;
    if (!isNil(backupUUID)) {
      return backupUUID;
    }
    const newBackupUUID = generateUUID();
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) =>
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

  async timeNow(): Promise<number> {
    return this.backgroundApi.servicePrimeCloudSync.timeNow();
  }

  // #region ---------------------------------------------- credential
  async checkPassword({
    password,
    context,
  }: {
    password: string;
    context: IDBContext;
  }): Promise<boolean> {
    if (!context) {
      console.error('Unable to get main context.');
      return false;
    }
    if (context.verifyString === DEFAULT_VERIFY_STRING) {
      return false;
    }
    try {
      const decrypted = await decryptVerifyString({
        password,
        verifyString: context.verifyString,
      });
      return decrypted === DEFAULT_VERIFY_STRING;
    } catch {
      return false;
    }
  }

  async verifyPassword({ password }: { password: string }): Promise<void> {
    const ctx = await this.getContext();
    if (ctx && ctx.verifyString !== DEFAULT_VERIFY_STRING) {
      ensureSensitiveTextEncoded(password);
      const isValid = await this.checkPassword({
        password,
        context: ctx,
      });
      if (isValid) {
        return;
      }
      throw new WrongPassword();
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
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txUpdateContext({
        tx,
        updater: (record) => {
          record.verifyString = DEFAULT_VERIFY_STRING;
          return record;
        },
      });
    });
  }

  async addHyperLiquidAgentCredential({
    credential,
    password,
  }: {
    credential: ICoreHyperLiquidAgentCredential;
    password: string;
  }) {
    const credentialId = accountUtils.buildHyperLiquidAgentCredentialId({
      userAddress: credential.userAddress,
      agentName: credential.agentName,
    });
    const credentialEncrypt = await encryptHyperLiquidAgentCredential({
      credential,
      password,
    });
    return this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Credential,
        records: [{ id: credentialId, credential: credentialEncrypt }],
      });
      return { credentialId };
    });
  }

  async updateHyperLiquidAgentCredential({
    credential,
    password,
  }: {
    credential: ICoreHyperLiquidAgentCredential;
    password: string;
  }) {
    const credentialId = accountUtils.buildHyperLiquidAgentCredentialId({
      userAddress: credential.userAddress,
      agentName: credential.agentName,
    });
    const credentialEncrypt = await encryptHyperLiquidAgentCredential({
      credential,
      password,
    });
    return this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Credential,
        ids: [credentialId],
        updater: (record) => {
          record.credential = credentialEncrypt;
          return record;
        },
      });
      return { credentialId };
    });
  }

  async getHyperLiquidAgentCredential({
    userAddress,
    agentName,
    password,
  }: {
    userAddress: string;
    agentName: EHyperLiquidAgentName;
    password: string;
  }): Promise<ICoreHyperLiquidAgentCredential | undefined> {
    const credentialId = accountUtils.buildHyperLiquidAgentCredentialId({
      userAddress,
      agentName,
    });
    const credential = await this.getCredentialSafe(credentialId);
    if (!credential) {
      return undefined;
    }
    const credentialDecrypt = await decryptHyperLiquidAgentCredential({
      credential: credential.credential,
      password,
    });
    return credentialDecrypt;
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
    if (!oldPassword || !newPassword) {
      throw new OneKeyLocalError('password is required');
    }

    // update all credentials
    const { recordPairs: credentialsRecordPairs } = await this.txGetAllRecords({
      tx,
      name: ELocalDBStoreNames.Credential,
    });

    await this.txUpdateRecords({
      tx,
      recordPairs: credentialsRecordPairs.filter(Boolean),
      name: ELocalDBStoreNames.Credential,
      updater: async (credential) => {
        if (credential.id.startsWith('imported')) {
          // Ton mnemonic credential
          if (accountUtils.isTonMnemonicCredentialId(credential.id)) {
            const revealableSeed: IBip39RevealableSeed =
              await decryptRevealableSeed({
                rs: credential.credential,
                password: oldPassword,
              });
            credential.credential = await encryptRevealableSeed({
              rs: revealableSeed,
              password: newPassword,
            });
          } else {
            const importedCredential: ICoreImportedCredential =
              await decryptImportedCredential({
                credential: credential.credential,
                password: oldPassword,
              });
            credential.credential = await encryptImportedCredential({
              credential: importedCredential,
              password: newPassword,
            });
          }
        }
        if (credential.id.startsWith('hd')) {
          const revealableSeed: IBip39RevealableSeed =
            await decryptRevealableSeed({
              rs: credential.credential,
              password: oldPassword,
            });
          credential.credential = await encryptRevealableSeed({
            rs: revealableSeed,
            password: newPassword,
          });
        }
        if (
          credential.id.startsWith(
            accountUtils.HYPERLIQUID_AGENT_CREDENTIAL_PREFIX,
          )
        ) {
          const hyperLiquidAgentCredential: ICoreHyperLiquidAgentCredential =
            await decryptHyperLiquidAgentCredential({
              credential: credential.credential,
              password: oldPassword,
            });
          credential.credential = await encryptHyperLiquidAgentCredential({
            credential: hyperLiquidAgentCredential,
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
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
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
    if (oldPassword) {
      await this.verifyPassword({ password: oldPassword });
    }
    if (!oldPassword && !isCreateMode) {
      throw new OneKeyLocalError(
        'changePassword ERROR: oldPassword is required',
      );
    }

    // may take too long, causing transaction to be automatically committed, so it needs to be outside the transaction
    const verifyString = await encryptVerifyString({ password: newPassword });

    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      if (oldPassword) {
        // update all credentials
        await this.txUpdateAllCredentialsPassword({
          tx,
          oldPassword,
          newPassword,
        });
      }

      let ctx = await this.txGetContext({ tx });

      ctx = await this.txGetContext({ tx });

      // update context verifyString
      await this.txUpdateContextVerifyString({
        tx,
        verifyString,
      });
    });
  }

  async getAllCredentials(): Promise<IDBCredentialBase[]> {
    const { records: credentials } = await this.getAllRecords({
      name: ELocalDBStoreNames.Credential,
    });
    return credentials;
  }

  async removeCredentials({
    credentials,
  }: {
    credentials: IDBCredentialBase[];
  }) {
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txRemoveRecords({
        tx,
        name: ELocalDBStoreNames.Credential,
        ids: credentials.map((item) => item.id),
      });
    });
  }

  async getCredential(credentialId: string): Promise<IDBCredentialBase> {
    const credential = await this.getRecordById({
      name: ELocalDBStoreNames.Credential,
      id: credentialId,
    });
    return credential;
  }

  async getCredentialSafe(
    credentialId: string,
  ): Promise<IDBCredentialBase | undefined> {
    try {
      return await this.getCredential(credentialId);
    } catch (error) {
      return undefined;
    }
  }

  // #endregion

  // #region ---------------------------------------------- wallet

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
    const includingAccounts = option?.includingAccounts;

    let allIndexedAccounts: IDBIndexedAccount[] | undefined;
    if (includingAccounts) {
      if (!allIndexedAccounts) {
        allIndexedAccounts =
          option?.allIndexedAccounts ||
          (await this.getAllIndexedAccounts()).indexedAccounts;
      }
    }

    const fillDbAccounts = async (newWallet: IDBWallet) => {
      const isOthersWallet = accountUtils.isOthersWallet({
        walletId: newWallet.id,
      });
      if (isOthersWallet) {
        const { accounts } = await this.getSingletonAccountsOfWallet({
          walletId: newWallet.id as IDBWalletIdSingleton,
        });
        newWallet.dbAccounts = accounts;
      } else {
        const { accounts } = await this.getIndexedAccountsOfWallet({
          dbWallet: newWallet,
          walletId: newWallet.id,
          allIndexedAccounts,
        });
        newWallet.dbIndexedAccounts = accounts;
      }
    };

    // get all wallets for account selector
    const allWallets =
      option?.allWallets || (await this.getAllWallets()).wallets;
    let wallets = allWallets;
    const allDevices =
      option?.allDevices || (await this.getAllDevices()).devices;
    const hiddenWalletsMap: Partial<{
      [dbDeviceId: string]: IDBWallet[];
    }> = {};

    const hwStandardWalletsMap: Partial<{
      [dbDeviceId: string]: IDBWallet | null;
    }> = {};

    // const label = device?.featuresInfo?.label; // standard hw wallet name/label

    wallets = wallets.filter((wallet) => {
      if (
        accountUtils.isHwOrQrWallet({ walletId: wallet.id }) &&
        !accountUtils.isHwHiddenWallet({
          wallet,
        })
      ) {
        const dbDeviceId = wallet.associatedDevice;
        if (dbDeviceId) {
          hwStandardWalletsMap[dbDeviceId] = wallet;
        }
      }

      if (this.isTempWalletRemoved({ wallet })) {
        return false;
      }

      if (
        option?.ignoreNonBackedUpWallets &&
        accountUtils.isHdWallet({ walletId: wallet.id }) &&
        !wallet.backuped
      ) {
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
        const dbDeviceId = wallet.associatedDevice;
        hiddenWalletsMap[dbDeviceId] = hiddenWalletsMap[dbDeviceId] || [];
        hiddenWalletsMap[dbDeviceId]?.push(wallet);
        if (hwStandardWalletsMap[dbDeviceId] === undefined) {
          hwStandardWalletsMap[dbDeviceId] = null;
        }
        return false;
      }
      return true;
    });
    const refilledWalletsCache: {
      [walletId: string]: IDBWallet;
    } = {};
    wallets = await Promise.all(
      wallets.map(async (w) => {
        const newWallet: IDBWallet = await this.refillWalletInfo({
          refilledWalletsCache,
          allDevices,
          wallet: w,
          hiddenWallets: w.associatedDevice
            ? (hiddenWalletsMap[w.associatedDevice] || []).filter((hw) =>
                hw.id.startsWith(w.id),
              )
            : undefined,
        });
        if (includingAccounts) {
          await Promise.all([
            fillDbAccounts(newWallet),
            ...(newWallet?.hiddenWallets || []).map(async (hw) => {
              await fillDbAccounts(hw);
              return hw;
            }),
          ]);
        }
        return newWallet;
      }),
    );
    wallets = wallets.sort(this.walletSortFn);

    return {
      wallets,
    };
  }

  async getWallet({
    refilledWalletsCache,
    walletId,
    withoutRefill,
  }: {
    refilledWalletsCache?: {
      [walletId: string]: IDBWallet;
    };
    walletId: string;
    withoutRefill?: boolean;
  }): Promise<IDBWallet> {
    const wallet = await this.getRecordById({
      name: ELocalDBStoreNames.Wallet,
      id: walletId,
    });
    if (withoutRefill) {
      return wallet;
    }
    return this.refillWalletInfo({ wallet, refilledWalletsCache });
  }

  async getWalletSafe({
    refilledWalletsCache,
    walletId,
    withoutRefill,
  }: {
    refilledWalletsCache?: {
      [walletId: string]: IDBWallet;
    };
    walletId: string;
    withoutRefill?: boolean;
  }): Promise<IDBWallet | undefined> {
    try {
      return await this.getWallet({
        walletId,
        refilledWalletsCache,
        withoutRefill,
      });
    } catch (error) {
      return undefined;
    }
  }

  async getWalletsByXfp({ xfp }: { xfp: string }): Promise<IDBWallet[]> {
    try {
      if (!xfp) {
        return [];
      }
      // TODO performance
      const { wallets } = await this.getWallets();
      const walletsByXfp = wallets.filter((w) => w.xfp === xfp);
      return walletsByXfp;
    } catch (error) {
      return [];
    }
  }

  async getWalletBySyncPayload({
    payload,
  }: {
    payload: {
      walletHash: string | undefined;
      hwDeviceId: string | undefined;
      passphraseState: string | undefined;
      walletType: IDBWalletType | undefined;
    };
  }): Promise<IDBWallet | undefined> {
    try {
      if (!payload) {
        return undefined;
      }
      const { walletType, walletHash, hwDeviceId, passphraseState } = payload;
      // TODO performance
      const { wallets } = await this.getWallets();
      if (walletType === WALLET_TYPE_HD) {
        const wallet = wallets.find(
          (w) => w.type === walletType && w.hash === walletHash,
        );
        return wallet;
      }
      if (walletType === WALLET_TYPE_HW || walletType === WALLET_TYPE_QR) {
        const device = await this.backgroundApi.localDb.getDeviceByQuery({
          featuresDeviceId: hwDeviceId, // rawDeviceId
        });
        if (device?.id) {
          const hwWallet = wallets.find((w) => {
            const r =
              w.type === walletType && w.associatedDevice === device?.id;
            if (passphraseState) {
              return r && w.passphraseState === passphraseState;
            }
            return r;
          });
          return hwWallet;
        }
      }
      return undefined;
    } catch (error) {
      return undefined;
    }
  }

  async getWalletByIndexedAccountId({
    indexedAccountId,
  }: {
    indexedAccountId: string;
  }): Promise<IDBWallet | undefined> {
    try {
      const { walletId } = accountUtils.parseIndexedAccountId({
        indexedAccountId,
      });
      if (!walletId) {
        return undefined;
      }
      return await this.getWalletSafe({
        walletId,
      });
    } catch (error) {
      return undefined;
    }
  }

  async getParentWalletOfHiddenWallet({
    refilledWalletsCache,
    dbDeviceId,
    isQr,
  }: {
    refilledWalletsCache?: {
      [walletId: string]: IDBWallet;
    };
    dbDeviceId: string;
    isQr: boolean;
  }): Promise<IDBWallet | undefined> {
    let parentWalletId = accountUtils.buildHwWalletId({
      dbDeviceId,
    });
    if (isQr) {
      parentWalletId = accountUtils.buildQrWalletId({
        dbDeviceId,
        xfpHash: '',
      });
    }
    let parentWallet: IDBWallet | undefined =
      refilledWalletsCache?.[parentWalletId];
    if (!parentWallet) {
      parentWallet = await this.getWalletSafe({
        walletId: parentWalletId,
        refilledWalletsCache,
      });
      if (parentWallet && refilledWalletsCache) {
        refilledWalletsCache[parentWalletId] = parentWallet;
      }
    }
    // const parentWallet = await db.getRecordById({
    // name: ELocalDBStoreNames.Wallet,
    // id: parentWalletId,
    // });
    return parentWallet;
  }

  async refillWalletInfo({
    refilledWalletsCache,
    wallet,
    hiddenWallets,
    allDevices,
  }: {
    refilledWalletsCache?: {
      [walletId: string]: IDBWallet;
    };
    wallet: IDBWallet;
    hiddenWallets?: IDBWallet[];
    allDevices?: IDBDevice[];
  }): Promise<IDBWallet> {
    let avatarInfo: IAvatarInfo | undefined;
    try {
      const parsedAvatar = JSON.parse(wallet.avatar || '{}');
      if (parsedAvatar && Object.keys(parsedAvatar).length > 0) {
        avatarInfo = parsedAvatar;
      }
    } catch (error) {
      console.error('refillWalletInfo', error);
    }

    wallet.avatarInfo = avatarInfo;
    wallet.walletOrder = wallet.walletOrderSaved ?? wallet.walletNo;
    if (accountUtils.isHwHiddenWallet({ wallet })) {
      const parentWallet = await this.getParentWalletOfHiddenWallet({
        refilledWalletsCache,
        dbDeviceId: wallet.associatedDevice || '',
        isQr: accountUtils.isQrWallet({ walletId: wallet.id }), // wallet.type === WALLET_TYPE_QR
      });
      if (parentWallet) {
        wallet.walletOrder =
          (parentWallet.walletOrderSaved ?? parentWallet.walletNo) +
          (wallet.walletOrderSaved ?? wallet.walletNo) / 1_000_000;
      }
    }

    if (hiddenWallets && hiddenWallets.length > 0) {
      wallet.hiddenWallets = await Promise.all(
        hiddenWallets.map((item) =>
          this.refillWalletInfo({
            wallet: item,
            refilledWalletsCache,
            allDevices,
          }),
        ),
      );
      wallet.hiddenWallets = wallet.hiddenWallets.sort(this.walletSortFn);
    }

    // others wallet name i18n
    if (
      accountUtils.isOthersWallet({
        walletId: wallet.id,
      })
    ) {
      const $appLocale = appLocale;
      await $appLocale.isReady;
      if (accountUtils.isWatchingWallet({ walletId: wallet.id })) {
        wallet.name = $appLocale.intl.formatMessage({
          id: ETranslations.wallet_label_watch_only,
        });
      }
      if (accountUtils.isExternalWallet({ walletId: wallet.id })) {
        wallet.name = $appLocale.intl.formatMessage({
          id: ETranslations.global_connected_account,
        });
      }
      if (accountUtils.isImportedWallet({ walletId: wallet.id })) {
        wallet.name = $appLocale.intl.formatMessage({
          id: ETranslations.wallet_label_private_key,
        });
      }
    }

    const shouldFixAvatar =
      (accountUtils.isHwWallet({ walletId: wallet.id }) ||
        accountUtils.isQrWallet({ walletId: wallet.id })) &&
      !accountUtils.isHwHiddenWallet({ wallet });
    const shouldFixName =
      accountUtils.isHwWallet({ walletId: wallet.id }) &&
      !accountUtils.isQrWallet({ walletId: wallet.id }) &&
      !accountUtils.isHwHiddenWallet({ wallet });

    let associatedDeviceInfo: IDBDevice | undefined;
    if (wallet.associatedDevice) {
      associatedDeviceInfo = await this.getWalletDeviceSafe({
        walletId: wallet.id,
        dbWallet: wallet,
        allDevices,
      });
      wallet.associatedDeviceInfo = associatedDeviceInfo;
    }

    // hw wallet use device label as name
    if (shouldFixName || shouldFixAvatar) {
      if (wallet.associatedDevice) {
        const device = associatedDeviceInfo;

        if (shouldFixAvatar) {
          const deviceType = device?.deviceType;
          const serialNo = deviceUtils.getDeviceSerialNoFromFeatures(
            device?.featuresInfo,
          );
          if (device && deviceType === EDeviceType.Pro && serialNo) {
            const imgFromSerialNo = getDeviceAvatarImage(deviceType, serialNo);
            if (imgFromSerialNo !== avatarInfo?.img) {
              appEventBus.emit(
                EAppEventBusNames.UpdateWalletAvatarByDeviceSerialNo,
                {
                  walletId: wallet.id,
                  dbDeviceId: device.id,
                  avatarInfo: {
                    ...avatarInfo,
                    img: imgFromSerialNo,
                  },
                },
              );
              wallet.avatarInfo = {
                ...avatarInfo,
                img: imgFromSerialNo,
              };
            }
          }
        }

        if (shouldFixName) {
          const label = device?.featuresInfo?.label;
          if (device && label && label !== wallet.name) {
            appEventBus.emit(EAppEventBusNames.SyncDeviceLabelToWalletName, {
              walletId: wallet.id,
              dbDeviceId: device.id,
              label,
              walletName: wallet.name,
            });
            wallet.name = label;
          }
        }
      }
    }

    if (wallet.airGapAccountsInfoRaw) {
      wallet.airGapAccountsInfo = JSON.parse(wallet.airGapAccountsInfoRaw);
    }

    // eslint-disable-next-line spellcheck/spell-checker
    // wallet.xfp = 'aaaaaaaa'; // mock qr wallet xfp
    return wallet;
  }

  async updateWalletOrder({
    walletId,
    walletOrder,
  }: {
    walletId: string;
    walletOrder: number;
  }) {
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txUpdateWallet({
        tx,
        walletId,
        updater(item) {
          if (!isNil(walletOrder)) {
            item.walletOrderSaved = walletOrder;
          }
          return item;
        },
      });
    });
  }

  async updateWalletsHashAndXfp(walletsHashMap: {
    [walletId: string]: {
      hash?: string;
      xfp?: string;
    };
  }) {
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Wallet,
        ids: Object.keys(walletsHashMap),
        updater(item) {
          const newHash = walletsHashMap[item.id]?.hash;
          if (!isNil(newHash)) {
            item.hash = newHash;
          }
          const newXfp = walletsHashMap[item.id]?.xfp;
          if (!isNil(newXfp)) {
            item.xfp = newXfp;
          }
          return item;
        },
      });
    });
  }

  async updateIndexedAccountOrder({
    indexedAccountId,
    order,
  }: {
    indexedAccountId: string;
    order: number;
  }) {
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.IndexedAccount,
        ids: [indexedAccountId],
        updater(item) {
          if (!isNil(order)) {
            item.orderSaved = order;
          }
          return item;
        },
      });
    });
  }

  async getIndexedAccountSafe({
    id,
  }: {
    id: string;
  }): Promise<IDBIndexedAccount | undefined> {
    try {
      return await this.getIndexedAccount({ id });
    } catch (error) {
      return undefined;
    }
  }

  async getIndexedAccount({ id }: { id: string }): Promise<IDBIndexedAccount> {
    const perf = perfUtils.createPerf({
      name: EPerformanceTimerLogNames.localDB__getIndexedAccount,
    });

    perf.markStart('getRecordById');
    const indexedAccount = await this.getRecordById({
      name: ELocalDBStoreNames.IndexedAccount,
      id,
    });
    perf.markEnd('getRecordById');

    perf.markStart('refillIndexedAccount');
    const result: IDBIndexedAccount = this.refillIndexedAccount({
      indexedAccount,
    });
    perf.markEnd('refillIndexedAccount');

    perf.done();
    return result;
  }

  refillIndexedAccount({
    indexedAccount,
  }: {
    indexedAccount: IDBIndexedAccount;
  }) {
    indexedAccount.order =
      indexedAccount.orderSaved ?? indexedAccount.index + 1;
    return indexedAccount;
  }

  async getIndexedAccountByAccount({
    account,
  }: {
    account: IDBAccount | undefined;
  }): Promise<IDBIndexedAccount | undefined> {
    const perf = perfUtils.createPerf({
      name: EPerformanceTimerLogNames.localDB__getIndexedAccountByAccount,
    });
    if (!account) {
      return undefined;
    }

    perf.markStart('checkAccountType');
    const accountId = account.id;
    if (
      accountUtils.isHdAccount({ accountId }) ||
      accountUtils.isQrAccount({ accountId }) ||
      accountUtils.isHwAccount({
        accountId,
      })
    ) {
      perf.markEnd('checkAccountType');

      const { indexedAccountId } = account;
      if (!indexedAccountId) {
        throw new OneKeyLocalError(
          `indexedAccountId is missing from account: ${accountId}`,
        );
      }

      perf.markStart('getIndexedAccount');
      // indexedAccount must be create before account, keep throw error here, do not try catch
      const indexedAccount = await this.getIndexedAccount({
        id: indexedAccountId,
      });
      perf.markEnd('getIndexedAccount');

      perf.done();
      return indexedAccount;
    }
    return undefined;
  }

  async getIndexedAccountsOfWallet({
    dbWallet,
    walletId,
    allIndexedAccounts,
  }: {
    dbWallet?: IDBWallet;
    walletId: string;
    allIndexedAccounts?: IDBIndexedAccount[];
  }) {
    let accounts: IDBIndexedAccount[] = [];

    const wallet =
      dbWallet ||
      (await this.getWalletSafe({
        walletId,
      }));
    if (wallet && !wallet?.isMocked) {
      // TODO performance
      const allIndexedAccounts0 =
        allIndexedAccounts ||
        (await this.getAllIndexedAccounts()).indexedAccounts;
      // console.log('getIndexedAccountsOfWallet', records);
      accounts = allIndexedAccounts0.filter(
        (item) => item.walletId === walletId,
      );
    }

    return {
      accounts: accounts
        .map((a) => this.refillIndexedAccount({ indexedAccount: a }))
        .sort((a, b) =>
          // indexedAccount sort by index
          natsort({ insensitive: true })(
            a.order ?? a.index,
            b.order ?? b.index,
          ),
        ),
    };
  }

  async addIndexedAccount({
    walletId,
    indexes,
    names,
    skipIfExists,
  }: {
    walletId: string;
    indexes: number[];
    names?: {
      [index: number]: string;
    };
    skipIfExists: boolean;
  }) {
    return this.withTransaction(EIndexedDBBucketNames.account, async (tx) =>
      this.txAddIndexedAccount({
        tx,
        walletId,
        skipIfExists,
        indexes,
        names,
      }),
    );
  }

  async buildIndexedAccountIdHash({
    firstEvmAddress,
    index,
    indexedAccountId,
  }: {
    firstEvmAddress: string | undefined;
    index: number | undefined;
    indexedAccountId: string;
    // dbDevice: IDBDevice | undefined;
  }) {
    // const hashContent = dbDevice
    //   ? `${dbDevice?.connectId}.${dbDevice?.deviceId}.${dbDevice?.deviceType}.${
    //       dbWallet?.passphraseState || ''
    //     }.${index}`
    //   : indexedAccountId;
    const hashContent =
      firstEvmAddress && !isNil(index)
        ? `${firstEvmAddress}--${index.toString()}`
        : indexedAccountId;
    const hashBuffer = await sha256(bufferUtils.toBuffer(hashContent, 'utf-8'));
    let idHash = bufferUtils.bytesToHex(hashBuffer);
    idHash = idHash.slice(-42);
    checkIsDefined(idHash);
    return idHash;
  }

  async txAddIndexedAccount({
    tx,
    walletId,
    indexes,
    names,
    skipIfExists,
    skipServerSyncFlow,
  }: {
    tx: ILocalDBTransaction;
    walletId: string;
    indexes: number[];
    names?: {
      [index: number]: string;
    };
    skipIfExists: boolean;
    skipServerSyncFlow?: boolean;
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

    const [dbWallet] = await this.txGetWallet({ tx, walletId });

    const accountDefaultNameMap: {
      [indexedAccountId: string]: string;
    } = {};
    const indexedAccountsPromise: Promise<IDBIndexedAccount>[] = indexes.map(
      async (index) => {
        const indexedAccountId = accountUtils.buildIndexedAccountId({
          walletId,
          index,
        });

        let accountName = names?.[index];
        if (!accountName) {
          const defaultName = accountUtils.buildIndexedAccountName({
            pathIndex: index,
          });
          accountDefaultNameMap[indexedAccountId] = defaultName;
          accountName = defaultName;
        }

        const r: IDBIndexedAccount = {
          id: indexedAccountId,
          idHash: await this.buildIndexedAccountIdHash({
            firstEvmAddress: dbWallet?.firstEvmAddress,
            indexedAccountId,
            index,
          }),
          walletId,
          index,
          name: accountName,
        };
        return r;
      },
    );
    const indexedAccounts = await Promise.all(indexedAccountsPromise);

    let indexedAccountsToAdd = indexedAccounts;

    // filter out existing indexed accounts
    if (skipIfExists) {
      const { records } = await this.txGetRecordsByIds({
        tx,
        name: ELocalDBStoreNames.IndexedAccount,
        ids: indexedAccountsToAdd.map((item) => item.id),
      });
      const existingIndexedAccounts = records.filter(Boolean);
      indexedAccountsToAdd = indexedAccountsToAdd.filter(
        (item) => !existingIndexedAccounts.some((r) => r.id === item.id),
      );
    }

    if (!indexedAccountsToAdd.length) {
      return indexedAccounts;
    }

    let dbDevice: IDBDevice | undefined;
    if (
      accountUtils.isHwWallet({ walletId }) ||
      accountUtils.isQrWallet({ walletId })
    ) {
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

    const syncManager =
      this.backgroundApi?.servicePrimeCloudSync.syncManagers.indexedAccount;

    const syncItemsInfo = await syncManager.buildExistingSyncItemsInfo({
      tx,
      targets: indexedAccountsToAdd.map((indexedAccount) => ({
        targetId: indexedAccount.id,
        dataType: EPrimeCloudSyncDataType.IndexedAccount,
        indexedAccount: { ...indexedAccount, name: indexedAccount.name },
        wallet: {
          ...dbWallet,
          name: dbWallet?.name || '',
          avatarInfo: dbWallet?.avatarInfo,
        },
        dbDevice,
      })),
      onExistingSyncItemsInfo: async (info) => {
        // fix account name by existing sync item
        indexedAccountsToAdd.forEach((indexedAccount) => {
          const existingItem = info[indexedAccount.id];
          const name = existingItem?.syncPayload?.name;
          if (name) {
            indexedAccount.name = name;
          }
        });
      },
      useCreateGenesisTime: async ({ target }) => {
        const accountDefaultName =
          accountDefaultNameMap[target.indexedAccount.id];
        return Boolean(
          accountDefaultName &&
            target.indexedAccount.name === accountDefaultName,
        );
      },
    });

    await syncManager.txWithSyncFlowOfDBRecordCreating({
      tx,
      newSyncItems: syncItemsInfo.newSyncItems,
      existingSyncItems: syncItemsInfo.existingSyncItems,
      runDbTxFn: async () => {
        await this.txAddRecords({
          tx,
          skipIfExists,
          name: ELocalDBStoreNames.IndexedAccount,
          records: indexedAccountsToAdd,
        });
        console.log('txAddIndexedAccount txGetWallet');
      },
      skipServerSyncFlow,
    });

    return indexedAccounts;
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
    let indexedAccountId = '';
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      ({ indexedAccountId } = await this.txAddHDNextIndexedAccount({
        tx,
        walletId,
        skipServerSyncFlow: false,
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
    skipServerSyncFlow,
  }: {
    tx: ILocalDBTransaction;
    walletId: string;
    onlyAddFirst?: boolean;
    skipServerSyncFlow: boolean;
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
        errorUtils.autoPrintErrorIgnore(error);
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
      skipServerSyncFlow,
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
    isOverrideWallet,
  }: {
    walletId: string;
    addedHdAccountIndex: number;
    isOverrideWallet?: boolean;
  }): Promise<{
    wallet: IDBWallet;
    indexedAccount: IDBIndexedAccount | undefined;
    device: IDBDevice | undefined;
    isOverrideWallet: boolean | undefined;
  }> {
    const dbWallet = await this.getWallet({
      walletId,
    });

    let dbIndexedAccount: IDBIndexedAccount | undefined;

    if (addedHdAccountIndex >= 0) {
      dbIndexedAccount = await this.getIndexedAccount({
        id: accountUtils.buildIndexedAccountId({
          walletId,
          index: addedHdAccountIndex,
        }),
      });
    }

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
      isOverrideWallet,
    };
  }

  _updateCloudSyncPoolItemFn({
    item,
    updateItem,
  }: {
    item: IDBCloudSyncItem | RealmSchemaCloudSyncItem;
    updateItem: IDBCloudSyncItem | undefined;
  }) {
    if (!updateItem) {
      return;
    }
    let shouldUpdate =
      item.dataTime &&
      updateItem.dataTime &&
      updateItem.dataTime >= item.dataTime;

    if (isNil(updateItem.dataTime)) {
      shouldUpdate = false;
    }

    if (isNil(item.dataTime)) {
      shouldUpdate = true;
    }

    if (item.pwdHash !== updateItem.pwdHash) {
      shouldUpdate = true;
    }

    if (!shouldUpdate) {
      return;
    }

    const tempUpdateItem: IDBCloudSyncItem = {
      // base fields
      id: item.id, // key
      rawKey: item.rawKey,
      dataType: item.dataType,
      // update fields
      rawData: updateItem.rawData,
      data: updateItem.data,
      dataTime: updateItem.dataTime ?? item.dataTime,
      isDeleted: updateItem.isDeleted,
      localSceneUpdated: updateItem.localSceneUpdated,
      serverUploaded: updateItem.serverUploaded,
      pwdHash: updateItem.pwdHash,
    };

    Object.keys(tempUpdateItem).forEach((key) => {
      if (!['id'].includes(key)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (item as any)[key] = (tempUpdateItem as any)[key];
      }
    });
  }

  async clearAllSyncItems() {
    const { syncItems } = await this.getAllSyncItems();
    // EIndexedDBBucketNames.cloudSync
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txRemoveRecords({
        tx,
        name: ELocalDBStoreNames.CloudSyncItem,
        ids: syncItems.map((item) => item.id),
      });
    });
  }

  async getAllSyncItems(): Promise<{
    syncItems: IDBCloudSyncItem[];
  }> {
    const { records } = await this.getAllRecords({
      name: ELocalDBStoreNames.CloudSyncItem,
    });
    return {
      syncItems: records.filter(
        (item) =>
          // TODO filter out deleted items
          Boolean(item) && item.dataType !== EPrimeCloudSyncDataType.Lock,
      ),
    };
  }

  async getSyncItem({ id }: { id: string }): Promise<IDBCloudSyncItem> {
    const item = await this.getRecordById({
      name: ELocalDBStoreNames.CloudSyncItem,
      id,
    });
    return item;
  }

  async getSyncItemSafe({
    id,
  }: {
    id: string;
  }): Promise<IDBCloudSyncItem | undefined> {
    try {
      const item = await this.getSyncItem({ id });
      if (item) {
        return item;
      }
    } catch (error) {
      console.error('getSyncItemSafe error', error);
      return undefined;
    }
  }

  async updateSyncItem({
    ids,
    updater,
  }: {
    ids: string[];
    updater: ILocalDBRecordUpdater<ELocalDBStoreNames.CloudSyncItem>;
  }) {
    // EIndexedDBBucketNames.cloudSync
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.CloudSyncItem,
        ids,
        updater,
      });
    });
  }

  async addAndUpdateSyncItems({
    items,
    skipUpdate,
    skipUploadToServer,
    fn,
  }: {
    items: IDBCloudSyncItem[];
    skipUpdate?: boolean;
    skipUploadToServer?: boolean;
    fn?: () => Promise<void>;
  }) {
    if (items?.length) {
      // EIndexedDBBucketNames.cloudSync
      await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
        await this.txAddAndUpdateSyncItems({
          tx,
          items,
          skipUpdate,
          skipUploadToServer,
        });

        await fn?.();
      });
    } else {
      await fn?.();
    }
  }

  async txAddAndUpdateSyncItems({
    tx,
    items,
    skipUpdate,
    skipUploadToServer,
  }: {
    tx: ILocalDBTransaction;
    items: IDBCloudSyncItem[];
    skipUpdate?: boolean;
    skipUploadToServer?: boolean;
  }) {
    // add new item
    await this.txAddRecords({
      tx,
      name: ELocalDBStoreNames.CloudSyncItem,
      skipIfExists: true,
      records: items,
    });

    // update existing item
    if (!skipUpdate) {
      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.CloudSyncItem,
        ids: items.map((item) => item.id),
        updater: (record) => {
          const recordToUpdate = items.find((item) => item.id === record.id);
          if (recordToUpdate) {
            this._updateCloudSyncPoolItemFn({
              item: record,
              updateItem: recordToUpdate,
            });
          }
          return record;
        },
      });
    }

    // upload to server
    if (!skipUploadToServer) {
      void this.backgroundApi?.servicePrimeCloudSync.apiUploadItems({
        localItems: items,
      });
    }
  }

  async removeCloudSyncPoolItems({ keys }: { keys: string[] }) {
    // EIndexedDBBucketNames.cloudSync
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txRemoveCloudSyncPoolItems({ tx, keys });
    });
  }

  async txRemoveCloudSyncPoolItems({
    tx,
    keys,
  }: {
    tx: ILocalDBTransaction;
    keys: string[];
  }) {
    try {
      console.log('txRemoveCloudSyncPoolItems', keys);
      await this.txRemoveRecords({
        tx,
        name: ELocalDBStoreNames.CloudSyncItem,
        ignoreNotFound: true,
        ids: keys.filter(Boolean),
      });
    } catch (error) {
      console.error('txRemoveCloudSyncPoolItems error', error);
    }
  }

  async txSyncFlowOfWalletCreateBase({
    tx,
    walletToAdd,
    deviceToAdd,
  }: {
    tx: ILocalDBTransaction;
    walletToAdd: IDBWallet;
    deviceToAdd: IDBDevice;
  }) {
    //
  }

  async createHDWallet(params: IDBCreateHDWalletParams): Promise<{
    wallet: IDBWallet;
    indexedAccount: IDBIndexedAccount | undefined;
  }> {
    const {
      password,
      name,
      avatar: initAvatarInfo,
      backuped,
      rs,
      walletHash,
      walletXfp,
    } = params;
    const context = await this.getContext({ verifyPassword: password });
    const walletId = accountUtils.buildHdWalletId({
      nextHD: context.nextHD,
    });
    const defaultWalletName = `Wallet ${context.nextHD}`;
    const initWalletName = name || defaultWalletName;

    const firstAccountIndex = 0;

    let addedHdAccountIndex = -1;

    let currentWalletToCreate: IDBWallet | undefined;
    let currentAvatarInfo: IAvatarInfo | undefined;
    const rebuildWalletRecord = (options: {
      name: string;
      avatar: IAvatarInfo | undefined;
    }) => {
      const _walletToCreate: IDBWallet = {
        id: walletId,
        name: options.name,
        hash: walletHash || undefined,
        xfp: walletXfp || undefined,
        avatar: options.avatar ? JSON.stringify(options.avatar) : undefined,
        type: WALLET_TYPE_HD,
        backuped,
        nextIds: {
          accountHdIndex: firstAccountIndex,
        },
        accounts: [],
        walletNo: context.nextWalletNo,
        deprecated: false,
      };
      currentWalletToCreate = _walletToCreate;
      currentAvatarInfo = options.avatar;
    };

    rebuildWalletRecord({
      name: initWalletName,
      avatar: initAvatarInfo,
    });

    if (!currentWalletToCreate) {
      throw new OneKeyLocalError('currentWalletToCreate is undefined');
    }

    const isUsingDefaultName = () =>
      currentWalletToCreate?.name === defaultWalletName;

    const syncManager =
      this.backgroundApi.servicePrimeCloudSync.syncManagers.wallet;

    const { existingSyncItems, newSyncItems } =
      await syncManager.buildExistingSyncItemsInfo({
        targets: [
          {
            targetId: currentWalletToCreate.id,
            dataType: EPrimeCloudSyncDataType.Wallet,
            wallet: {
              ...currentWalletToCreate,
              name: currentWalletToCreate.name,
              avatarInfo: currentAvatarInfo,
            },
            dbDevice: undefined, // hw/qr wallet only
          },
        ],
        onExistingSyncItemsInfo: async (existingSyncItemsInfo) => {
          if (!currentWalletToCreate) {
            return;
          }
          const syncPayload =
            existingSyncItemsInfo[currentWalletToCreate?.id]?.syncPayload;

          if (!syncPayload) {
            return;
          }

          rebuildWalletRecord({
            name:
              syncPayload.name ||
              currentWalletToCreate?.name ||
              defaultWalletName,
            avatar: syncPayload.avatar || currentAvatarInfo,
          });
        },
        useCreateGenesisTime: async ({ target }) => {
          // Avoid syncing the default name of the mnemonic wallet when creating a wallet on other devices that are not prime members
          const b: boolean = isUsingDefaultName();
          return b;
        },
      });

    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      if (!currentWalletToCreate) {
        return;
      }

      await syncManager.txWithSyncFlowOfDBRecordCreating({
        tx,
        newSyncItems,
        existingSyncItems,
        runDbTxFn: async () => {
          console.log('add db wallet');
          // add db wallet
          await this.txAddRecords({
            tx,
            name: ELocalDBStoreNames.Wallet,
            records: [currentWalletToCreate].filter(Boolean),
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

          // add first indexed account
          console.log('add first indexed account');
          const { nextIndex } = await this.txAddHDNextIndexedAccount({
            tx,
            walletId,
            onlyAddFirst: true,
            skipServerSyncFlow: false,
          });
          addedHdAccountIndex = nextIndex;

          // increase nextHD
          console.log('increase nextHD');
          await this.txUpdateContext({
            tx,
            updater: (ctx) => {
              ctx.nextHD += 1;
              ctx.nextWalletNo += 1;
              return ctx;
            },
          });
        },
      });
    });

    return this.buildCreateHDAndHWWalletResult({
      walletId,
      addedHdAccountIndex,
    });
  }

  async updateFirmwareVerified(params: IDBUpdateFirmwareVerifiedParams) {
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
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

    let isUpdated = false;
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Device,
        ids: [device.id],
        updater: async (item) => {
          const newFeatures = stringUtils.stableStringify(features);
          if (item.features !== newFeatures) {
            item.features = newFeatures;
            isUpdated = true;
          }
          return item;
        },
      });
    });
    if (isUpdated) {
      appEventBus.emit(EAppEventBusNames.HardwareFeaturesUpdate, {
        deviceId: device.id,
      });
    }
  }

  async updateDeviceFeaturesLabel({
    dbDeviceId,
    label,
  }: {
    dbDeviceId: string;
    label: string;
  }) {
    const device = await this.getDevice(dbDeviceId);
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Device,
        ids: [dbDeviceId],
        updater: async (item) => {
          item.features = JSON.stringify({
            ...device.featuresInfo,
            label,
          });
          return item;
        },
      });
    });
  }

  async updateDeviceFeaturesPassphraseProtection({
    dbDeviceId,
    passphraseProtection,
  }: {
    dbDeviceId: string;
    passphraseProtection: boolean;
  }) {
    const device = await this.getDevice(dbDeviceId);
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Device,
        ids: [dbDeviceId],
        updater: async (item) => {
          item.features = JSON.stringify({
            ...device.featuresInfo,
            passphrase_protection: passphraseProtection,
          });
          return item;
        },
      });
    });
  }

  async updateDeviceVersionInfo({
    dbDeviceId,
    versionCacheInfo,
  }: {
    dbDeviceId: string;
    versionCacheInfo: IDeviceVersionCacheInfo;
  }) {
    const device = await this.getDevice(dbDeviceId);
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Device,
        ids: [dbDeviceId],
        updater: async (item) => {
          item.features = JSON.stringify({
            ...device.featuresInfo,
            ...versionCacheInfo,
          });
          return item;
        },
      });
    });
  }

  async updateDeviceConnectId({
    dbDeviceId,
    usbConnectId,
    bleConnectId,
  }: {
    dbDeviceId: string;
    usbConnectId?: string;
    bleConnectId?: string;
  }) {
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Device,
        ids: [dbDeviceId],
        updater: async (item) => {
          if (usbConnectId !== undefined) {
            item.usbConnectId = usbConnectId;
          }
          if (bleConnectId !== undefined) {
            item.bleConnectId = bleConnectId;
          }
          item.updatedAt = await this.timeNow();
          return item;
        },
      });
    });
  }

  async cleanDeviceConnectId({ dbDeviceId }: { dbDeviceId: string }) {
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Device,
        ids: [dbDeviceId],
        updater: async (item) => {
          item.usbConnectId = undefined;
          item.bleConnectId = undefined;
          item.updatedAt = await this.timeNow();
          return item;
        },
      });
    });
  }

  async fixHiddenWalletName({
    dbDeviceId,
    dbWalletId,
  }: {
    dbDeviceId: string;
    dbWalletId: string;
  }): Promise<{
    parentWalletId: string | undefined;
    hiddenWalletName: string | undefined;
  }> {
    const parentWallet = await this.getParentWalletOfHiddenWallet({
      dbDeviceId,
      isQr: accountUtils.isQrWallet({ walletId: dbWalletId }),
    });
    const parentWalletId = parentWallet?.id;
    const hiddenWalletName = parentWallet
      ? accountUtils.buildHiddenWalletName({
          parentWallet,
        })
      : undefined;
    return {
      parentWalletId,
      hiddenWalletName,
    };
  }

  async createQrWallet({
    qrDevice,
    airGapAccounts,
    fullXfp = '',
    isMockedStandardHwWallet,
    existingDeviceId,
  }: IDBCreateQRWalletParams) {
    const { deviceId: rawDeviceId } = qrDevice;
    const existingDevice = await this.getDeviceByQuery({
      featuresDeviceId: rawDeviceId,
    });

    const dbDeviceId =
      existingDevice?.id || existingDeviceId || accountUtils.buildDeviceDbId();

    if (!fullXfp && !isMockedStandardHwWallet) {
      throw new OneKeyLocalError('fullXfp is required');
    }

    let passphraseState = '';
    let xfpHash = '';
    let xfpHashLegacy = '';

    // TODO support OneKey Pro device only
    const deviceType: IDeviceType = EDeviceType.Pro;
    // TODO name should be OneKey Pro-xxxxxx
    let deviceName = qrDevice.name || 'OneKey Pro';
    const nameArr = deviceName.split('-');
    if (nameArr.length >= 2) {
      const lastHash = nameArr[nameArr.length - 1];
      if (lastHash.length === 8) {
        // hidden wallet take name last hash as passphraseState
        passphraseState = lastHash;
        deviceName = nameArr.slice(0, nameArr.length - 1).join('');
      }
    }
    const deviceNameArr = deviceName.split(':');
    deviceName = deviceNameArr?.[0] || deviceName;
    const serialNo: string | undefined = deviceNameArr?.[1] || undefined;

    if (passphraseState || qrDevice.buildBy === 'hdkey') {
      if (fullXfp) {
        xfpHash = bufferUtils.bytesToHex(
          await sha256(bufferUtils.toBuffer(fullXfp, 'utf8')),
        );
      }
      if (qrDevice.xfp) {
        xfpHashLegacy = bufferUtils.bytesToHex(
          await sha256(bufferUtils.toBuffer(qrDevice.xfp, 'utf8')),
        );
      }
    }
    let walletName = deviceName;
    let hiddenDefaultWalletName: string | undefined;

    const now = await this.timeNow();

    const imgFromSerialNo = getDeviceAvatarImage(deviceType, serialNo);
    const avatarImg = imgFromSerialNo || deviceType;
    const avatar: IAvatarInfo = {
      img: avatarImg,
    };
    const context = await this.getContext();

    let dbWalletId = accountUtils.buildQrWalletId({
      dbDeviceId,
      xfpHash,
    });
    if (xfpHashLegacy) {
      const dbWalletIdLegacy = accountUtils.buildQrWalletId({
        dbDeviceId,
        xfpHash: xfpHashLegacy,
      });
      if (dbWalletIdLegacy) {
        const walletLegacy = await this.getWalletSafe({
          walletId: dbWalletIdLegacy,
        });
        if (walletLegacy) {
          dbWalletId = walletLegacy.id;
        }
      }
    }

    let parentWalletId: string | undefined;
    if (passphraseState) {
      const fixHiddenWalletInfo = async () => {
        const hiddenWalletNameInfo = await this.fixHiddenWalletName({
          dbDeviceId,
          dbWalletId,
        });
        parentWalletId = hiddenWalletNameInfo.parentWalletId;
        walletName = hiddenWalletNameInfo.hiddenWalletName || deviceName;
        hiddenDefaultWalletName = hiddenWalletNameInfo.hiddenWalletName;
      };

      await fixHiddenWalletInfo();

      if (!parentWalletId && !isMockedStandardHwWallet) {
        const parentWalletIdToCreate = accountUtils.buildQrWalletId({
          dbDeviceId,
          xfpHash: '',
        });

        const createStandardWalletResult = await this.createQrWallet({
          qrDevice: {
            ...qrDevice,
            name: nameArr[0],
            xfp: '',
          },
          fullXfp: '',
          airGapAccounts: [],
          isMockedStandardHwWallet: true,
          existingDeviceId: dbDeviceId,
        });
        parentWalletId = createStandardWalletResult.wallet?.id;
        if (!parentWalletId) {
          // make sure UI loading visible
          await timerUtils.wait(1000);
          throw new OneKeyErrorAirGapStandardWalletRequiredWhenCreateHiddenWallet();
        }
      }

      await fixHiddenWalletInfo();
    }

    // TODO parse passphraseState from deviceName
    // const passphraseState = deviceName;

    const firstAccountIndex = 0;
    let addedHdAccountIndex = -1;

    let featuresInfo:
      | {
          onekey_serial_no?: string;
          onekey_serial?: string;
          serial_no?: string;
        }
      | undefined;
    if (serialNo) {
      featuresInfo = {
        onekey_serial_no: serialNo || undefined,
        onekey_serial: serialNo || undefined,
        serial_no: serialNo || undefined,
      };
    }
    const featuresStr = featuresInfo ? JSON.stringify(featuresInfo) : '';

    const deviceToAdd: IDBDevice = existingDevice || {
      id: dbDeviceId,
      name: deviceName,
      connectId: '',
      uuid: '',
      deviceId: rawDeviceId,
      deviceType,
      // TODO save qrDevice last version(not updated version)
      features: featuresStr,
      settingsRaw: '',
      createdAt: now,
      updatedAt: now,
    };

    const existingWallet = await this.getWalletSafe({
      walletId: dbWalletId,
    });

    const isExistingHiddenWallet = accountUtils.isHwHiddenWallet({
      wallet: existingWallet,
    });

    const walletToAdd: IDBWallet = {
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
      xfp: fullXfp,

      deprecated: false,
      isMocked: isMockedStandardHwWallet ?? false,
    };

    const isUsingDefaultName = () => {
      if (walletToAdd.passphraseState) {
        return Boolean(walletToAdd.name === hiddenDefaultWalletName);
      }
      return Boolean(walletToAdd.name === deviceName);
    };

    const syncManager =
      this.backgroundApi.servicePrimeCloudSync.syncManagers.wallet;

    const { existingSyncItems, newSyncItems } =
      await syncManager.buildExistingSyncItemsInfo({
        targets: [
          {
            targetId: walletToAdd.id,
            dataType: EPrimeCloudSyncDataType.Wallet,
            wallet: {
              ...walletToAdd,
              name: walletToAdd.name,
              avatarInfo: avatar,
            },

            dbDevice: deviceToAdd,
          },
        ],
        onExistingSyncItemsInfo: async (existingSyncItemsInfo) => {
          if (!walletToAdd) {
            return;
          }
          const syncPayload =
            existingSyncItemsInfo[walletToAdd?.id]?.syncPayload;

          if (!syncPayload) {
            return;
          }

          walletToAdd.name = syncPayload.name || walletToAdd.name;
        },
        useCreateGenesisTime: async ({ target }) => {
          // Avoid syncing the default name of the mnemonic wallet when creating a wallet on other devices that are not prime members
          const b: boolean = isUsingDefaultName();
          return b;
        },
      });

    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await syncManager.txWithSyncFlowOfDBRecordCreating({
        tx,
        newSyncItems,
        existingSyncItems,
        runDbTxFn: async () => {
          if (existingDevice) {
            await this.txUpdateRecords({
              tx,
              name: ELocalDBStoreNames.Device,
              ids: [dbDeviceId],
              updater: async (item) => {
                item.updatedAt = now;
                // TODO update qrDevice last version(not updated version)

                if (!item.features && featuresStr) {
                  item.features = featuresStr;
                }
                return item;
              },
            });
          } else {
            await this.txAddDbDevice({
              tx,
              skipIfExists: true,
              device: deviceToAdd,
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
            records: [walletToAdd],
          });

          await this.txUpdateWallet({
            tx,
            walletId: dbWalletId,
            updater: (item) => {
              item.isTemp = false;
              item.xfp = fullXfp;

              if (!isMockedStandardHwWallet && !passphraseState) {
                item.isMocked = false;
              }

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

          if (passphraseState && parentWalletId && !existingWallet) {
            await this.txIncreaseParentWalletNextHiddenNum({
              parentWalletId,
              tx,
            });
          }

          // add first indexed account
          if (!isMockedStandardHwWallet) {
            const { nextIndex } = await this.txAddHDNextIndexedAccount({
              tx,
              walletId: dbWalletId,
              onlyAddFirst: true,
              skipServerSyncFlow: false,
            });
            addedHdAccountIndex = nextIndex;
          }

          console.log('increase nextWalletNo');
          // increase nextHD
          await this.txUpdateContext({
            tx,
            updater: (ctx) => {
              ctx.nextWalletNo += 1;
              return ctx;
            },
          });
        },
      });
    });

    // if (passphraseState) {
    // this.tempWallets[dbWalletId] = true;
    // }

    return this.buildCreateHDAndHWWalletResult({
      walletId: dbWalletId,
      addedHdAccountIndex,
      isOverrideWallet: Boolean(existingWallet && !existingWallet?.isMocked),
      // isOverrideWallet: existingWallet && !isExistingHiddenWallet,
    });
  }

  async txIncreaseParentWalletNextHiddenNum({
    tx,
    parentWalletId,
  }: {
    parentWalletId: string;
    tx: ILocalDBTransaction;
  }) {
    await this.txUpdateWallet({
      tx,
      walletId: parentWalletId,
      updater: (item) => {
        // DO NOT use  w.nextIds = w.nextIds || {};
        // it will reset nextIds to {}
        if (!item.nextIds) {
          item.nextIds = {};
        }

        item.nextIds.hiddenWalletNum = (item.nextIds.hiddenWalletNum || 1) + 1;
        return item;
      },
    });
  }

  async addDbDevice({
    device,
    skipIfExists,
  }: {
    device: IDBDevice;
    skipIfExists?: boolean;
  }) {
    return this.withTransaction(EIndexedDBBucketNames.account, async (tx) =>
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
    const rawDeviceId = deviceUtils.getRawDeviceId({
      device,
      features,
    });
    const existingDevice = await this.getExistingDevice({
      rawDeviceId,
      uuid: deviceUUID,
      getFirstEvmAddressFn: params.getFirstEvmAddressFn,
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
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
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
    const {
      name,
      device,
      features,
      xfp,
      passphraseState,
      isFirmwareVerified,
      defaultIsTemp,
      isMockedStandardHwWallet,
      transportType,
    } = params;
    console.log('createHwWallet', features);
    const { connectId } = device;
    if (!connectId) {
      throw new OneKeyLocalError('createHwWallet ERROR: connectId is required');
    }
    const context = await this.getContext();
    // const serialNo = features.onekey_serial ?? features.serial_no ?? '';

    // ble connected device type is inaccuracy
    const deviceTypeFromFeatures = await deviceUtils.getDeviceTypeFromFeatures({
      features,
    });
    const deviceType = deviceTypeFromFeatures || device.deviceType;

    const avatar: IAvatarInfo = {
      img: getDeviceAvatarImage(
        deviceType,
        deviceUtils.getDeviceSerialNoFromFeatures(features),
      ),
    };

    const { dbDeviceId, dbWalletId, deviceUUID, rawDeviceId } =
      await this.buildHwWalletId(params);

    const existingWallet = await this.getWalletSafe({
      walletId: dbWalletId,
    });

    const isExistingHiddenWallet = accountUtils.isHwHiddenWallet({
      wallet: existingWallet,
    });

    let parentWalletId: string | undefined;
    const deviceName = await deviceUtils.buildDeviceName({ device, features });
    let walletName = name || deviceName;
    let hiddenDefaultWalletName: string | undefined;
    if (passphraseState) {
      const hiddenWalletNameInfo = await this.fixHiddenWalletName({
        dbDeviceId,
        dbWalletId,
      });
      parentWalletId = hiddenWalletNameInfo.parentWalletId;
      walletName = name || hiddenWalletNameInfo.hiddenWalletName || walletName;
      hiddenDefaultWalletName = hiddenWalletNameInfo.hiddenWalletName;
    }

    const featuresStr = JSON.stringify(features);

    const firstAccountIndex = 0;

    let addedHdAccountIndex = -1;
    const now = await this.timeNow();

    // Set appropriate connectId fields based on transport type
    let usbConnectId: string | undefined;
    let bleConnectId: string | undefined;
    let compatibleConnectId: string | undefined;

    if (transportType) {
      switch (transportType) {
        case EHardwareTransportType.WEBUSB:
        case EHardwareTransportType.Bridge:
          // Bridge and WEBUSB are both USB-based connections
          usbConnectId = connectId;
          compatibleConnectId = connectId;
          break;
        case EHardwareTransportType.BLE:
          bleConnectId = connectId;
          compatibleConnectId = connectId;
          break;
        case EHardwareTransportType.DesktopWebBle:
          // BLE connections - set bleConnectId but don't override connectId
          // @ts-expect-error
          bleConnectId = device.bleConnectId || connectId;
          // If connectId is empty, get it from getDeviceUUID for compatibility
          if (!compatibleConnectId) {
            const { getDeviceUUID } = await CoreSDKLoader();
            const uuid = getDeviceUUID(features);
            compatibleConnectId = uuid;
            usbConnectId = uuid;
          }
          break;
        default:
          break;
      }
    }

    const deviceToAdd: IDBDevice = {
      id: dbDeviceId,
      name: deviceName,
      connectId: compatibleConnectId || '',
      uuid: deviceUUID,
      deviceId: rawDeviceId,
      deviceType,
      features: featuresStr,
      settingsRaw: JSON.stringify({
        inputPinOnSoftware: true,
      } as IDBDeviceSettings),
      createdAt: now,
      updatedAt: now,
      usbConnectId,
      bleConnectId,
    };

    const walletToAdd: IDBWallet = {
      id: dbWalletId,
      name: walletName,
      avatar: avatar && JSON.stringify(avatar),
      type: WALLET_TYPE_HW,
      backuped: true,
      associatedDevice: dbDeviceId,
      isTemp: defaultIsTemp ?? false,
      isMocked: isMockedStandardHwWallet ?? false,
      passphraseState,
      nextIds: {
        accountHdIndex: firstAccountIndex,
      },
      accounts: [],
      walletNo: context.nextWalletNo,
      deprecated: false,
      xfp,
    };

    const isUsingDefaultName = () =>
      Boolean(
        walletToAdd.passphraseState &&
          walletToAdd.name === hiddenDefaultWalletName,
      );

    const syncManager =
      this.backgroundApi.servicePrimeCloudSync.syncManagers.wallet;

    const { existingSyncItems, newSyncItems } =
      await syncManager.buildExistingSyncItemsInfo({
        targets: [
          {
            targetId: walletToAdd.id,
            dataType: EPrimeCloudSyncDataType.Wallet,
            wallet: {
              ...walletToAdd,
              name: walletToAdd.name,
              avatarInfo: avatar,
            },
            dbDevice: deviceToAdd,
          },
        ],
        onExistingSyncItemsInfo: async (existingSyncItemsInfo) => {
          if (!walletToAdd) {
            return;
          }

          const syncPayload =
            existingSyncItemsInfo[walletToAdd?.id]?.syncPayload;

          if (!syncPayload) {
            return;
          }

          walletToAdd.name = syncPayload.name || walletToAdd.name;
        },
        useCreateGenesisTime: async ({ target }) => {
          // Avoid syncing the default name of the mnemonic wallet when creating a wallet on other devices that are not prime members
          const b: boolean = isUsingDefaultName();
          return b;
        },
      });

    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await syncManager.txWithSyncFlowOfDBRecordCreating({
        tx,
        newSyncItems,
        existingSyncItems,

        runDbTxFn: async () => {
          // add db device
          await this.txAddDbDevice({
            tx,
            skipIfExists: true,
            device: deviceToAdd,
          });

          // update exists db device
          await this.txUpdateRecords({
            tx,
            name: ELocalDBStoreNames.Device,
            ids: [dbDeviceId],
            updater: async (item) => {
              item.features = featuresStr;
              item.updatedAt = now;

              // Use compatibleConnectId which includes getDeviceUUID fallback for BLE
              item.connectId = compatibleConnectId || item.connectId || '';
              item.uuid = deviceUUID;
              item.deviceId = rawDeviceId;
              item.deviceType = deviceType;

              // Update USB/BLE connectId fields
              if (!item.usbConnectId && usbConnectId !== undefined) {
                item.usbConnectId = usbConnectId;
              }
              if (bleConnectId !== undefined) {
                item.bleConnectId = bleConnectId;
              }

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
            records: [walletToAdd],
          });

          // update db wallet temp status
          await this.txUpdateWallet({
            tx,
            walletId: dbWalletId,
            updater: (item) => {
              if (passphraseState) {
                item.isTemp = false;
              } else if (item.isTemp) {
                item.isTemp = defaultIsTemp ?? false;
              }
              if (xfp) {
                item.xfp = xfp;
              }
              item.deprecated = false;
              if (!isMockedStandardHwWallet && !passphraseState) {
                item.isMocked = false;
              }
              return item;
            },
          });

          if (passphraseState && parentWalletId && !existingWallet) {
            await this.txIncreaseParentWalletNextHiddenNum({
              parentWalletId,
              tx,
            });
          }

          // add first indexed account
          if (!isMockedStandardHwWallet) {
            const { nextIndex } = await this.txAddHDNextIndexedAccount({
              tx,
              walletId: dbWalletId,
              onlyAddFirst: true,
              skipServerSyncFlow: false,
            });
            addedHdAccountIndex = nextIndex;
          }

          console.log('increase nextWalletNo');
          // increase nextHD
          await this.txUpdateContext({
            tx,
            updater: (ctx) => {
              ctx.nextWalletNo += 1;
              return ctx;
            },
          });
        },
      });
    });

    if (passphraseState) {
      this.tempWallets[dbWalletId] = true;
    }

    return this.buildCreateHDAndHWWalletResult({
      walletId: dbWalletId,
      addedHdAccountIndex,
      isOverrideWallet: Boolean(existingWallet && !existingWallet?.isMocked),
      // isOverrideWallet: existingWallet && !isExistingHiddenWallet,
    });
  }

  async clearQrWalletAirGapAccountKeys({ walletId }: { walletId: string }) {
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
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

  private async _getHwWalletsInSameDevice({
    associatedDevice,
    type = 'all',
    excludeMocked = false,
    excludeHwHidden = false,
  }: {
    associatedDevice: string | undefined;
    type?: 'all' | 'hw' | 'qr';
    excludeMocked?: boolean;
    excludeHwHidden?: boolean;
  }) {
    const { wallets } = await this.getAllWallets();

    return wallets.filter((wallet) => {
      if (
        !wallet.associatedDevice ||
        wallet.associatedDevice !== associatedDevice
      ) {
        return false;
      }

      if (excludeHwHidden && accountUtils.isHwHiddenWallet({ wallet })) {
        return false;
      }

      if (excludeMocked && wallet.isMocked) {
        return false;
      }

      if (type === 'hw') {
        return accountUtils.isHwWallet({ walletId: wallet.id });
      }
      if (type === 'qr') {
        return accountUtils.isQrWallet({ walletId: wallet.id });
      }

      // default all: hw or qr wallet
      return (
        accountUtils.isHwWallet({ walletId: wallet.id }) ||
        accountUtils.isQrWallet({ walletId: wallet.id })
      );
    });
  }

  async getNormalHwQrWalletInSameDevice({
    associatedDevice,
  }: {
    associatedDevice: string | undefined;
  }) {
    return this._getHwWalletsInSameDevice({
      associatedDevice,
      type: 'all',
      excludeHwHidden: true,
    });
  }

  async getNormalHwWalletInSameDevice({
    associatedDevice,
    excludeMocked = false,
  }: {
    associatedDevice: string | undefined;
    excludeMocked?: boolean;
  }) {
    return this._getHwWalletsInSameDevice({
      associatedDevice,
      type: 'hw',
      excludeMocked,
      excludeHwHidden: true,
    });
  }

  // TODO clean wallets which associatedDevice is removed
  // TODO remove associate indexedAccount and account
  async removeWallet({
    walletId,
    isRemoveToMocked,
  }: IDBRemoveWalletParams): Promise<void> {
    const wallet = await this.getWallet({
      walletId,
    });
    const walletsInSameDevice = await this.getNormalHwQrWalletInSameDevice({
      associatedDevice: wallet.associatedDevice,
    });
    const syncManagers = this.backgroundApi.servicePrimeCloudSync.syncManagers;

    const target = await syncManagers.wallet.buildSyncTargetByDBQuery({
      dbRecord: wallet,
    });
    // TODO buildSyncKeyAndPayloadSafe
    const syncKeyInfo = await syncManagers.wallet.buildSyncKeyAndPayload({
      target,
    });

    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      // call remove account & indexed account
      // remove credential
      // remove wallet
      // remove address

      const isHardware =
        accountUtils.isHwWallet({
          walletId,
        }) || accountUtils.isQrWallet({ walletId });
      if (isHardware) {
        if (
          !isRemoveToMocked &&
          wallet.associatedDevice &&
          !accountUtils.isHwHiddenWallet({ wallet })
        ) {
          // remove device
          if (
            walletsInSameDevice.length === 1 &&
            walletsInSameDevice[0].id === wallet.id
          ) {
            await this.txRemoveRecords({
              tx,
              name: ELocalDBStoreNames.Device,
              ids: [wallet.associatedDevice],
              ignoreNotFound: true,
            });
          }

          // remove all hidden wallets
          const { recordPairs } = await this.txGetAllRecords({
            tx,
            name: ELocalDBStoreNames.Wallet,
          });
          const allWallets = recordPairs.filter(Boolean);
          const matchedHiddenWallets = allWallets
            .filter(
              ([hiddenWallet]) =>
                hiddenWallet &&
                accountUtils.isHwHiddenWallet({ wallet: hiddenWallet }) &&
                hiddenWallet.id.startsWith(wallet.id) &&
                hiddenWallet.associatedDevice === wallet.associatedDevice,
            )
            ?.filter(Boolean);
          if (matchedHiddenWallets?.length) {
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

      if (
        isHardware &&
        !accountUtils.isHwHiddenWallet({ wallet }) &&
        isRemoveToMocked
      ) {
        await this.txUpdateWallet({
          tx,
          walletId,
          updater: (item) => {
            item.isMocked = true;
            return item;
          },
        });
      } else {
        await this.txRemoveRecords({
          tx,
          name: ELocalDBStoreNames.Wallet,
          ids: [walletId],
        });
      }

      if (accountUtils.isHdWallet({ walletId }) || isHardware) {
        const { recordPairs } = await this.txGetAllRecords({
          tx,
          name: ELocalDBStoreNames.IndexedAccount,
        });
        const allIndexedAccounts = recordPairs.filter(Boolean);
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

    await this.withTransaction(EIndexedDBBucketNames.archive, async (tx) => {
      const isHardware =
        accountUtils.isHwWallet({
          walletId,
        }) || accountUtils.isQrWallet({ walletId });

      if (
        isHardware &&
        !isRemoveToMocked &&
        wallet.associatedDevice &&
        !accountUtils.isHwHiddenWallet({ wallet })
      ) {
        try {
          // remove device home screen
          const deviceHomeScreenIds = await this.txGetRecordIds({
            tx,
            name: ELocalDBStoreNames.HardwareHomeScreen,
          });
          const needRemoveDeviceHomeScreenIds = deviceHomeScreenIds.filter(
            (id) =>
              wallet.associatedDevice && id.startsWith(wallet.associatedDevice),
          );
          if (needRemoveDeviceHomeScreenIds.length) {
            await this.txRemoveRecords({
              tx,
              name: ELocalDBStoreNames.HardwareHomeScreen,
              ids: needRemoveDeviceHomeScreenIds,
              ignoreNotFound: true,
            });
          }
        } catch (error) {
          console.log('remove device, clean home screen error');
        }
      }
    });

    await this.removeCloudSyncPoolItems({ keys: [syncKeyInfo.key] });

    delete this.tempWallets[walletId];

    appEventBus.emit(EAppEventBusNames.WalletRemove, {
      walletId,
    });
  }

  isTempWalletRemoved({ wallet }: { wallet: IDBWallet }): boolean {
    return Boolean(wallet?.isTemp && !this?.tempWallets?.[wallet.id]);
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
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
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
    const { walletId } = params;
    let wallet = await this.getWallet({ walletId });

    if (params.shouldCheckDuplicate && params.name) {
      const { wallets } = await this.getAllWallets();
      const isHiddenWallet = accountUtils.isHwHiddenWallet({ wallet });
      const duplicateWallets = wallets.filter((item) => {
        let r =
          !accountUtils.isOthersWallet({ walletId: item.id }) &&
          item.id !== walletId &&
          !item.isTemp &&
          item.name === params.name;

        if (isHiddenWallet) {
          r =
            r &&
            item.associatedDevice === wallet.associatedDevice &&
            item.type === wallet.type;
        }

        return r;
      });
      if (duplicateWallets.length) {
        throw new RenameDuplicateNameError();
      }
    }

    const walletName = params.name || wallet.name;
    let avatarInfo = wallet.avatarInfo;
    if (
      params.avatar &&
      isPlainObject(params.avatar) &&
      !isString(params.avatar)
    ) {
      avatarInfo = params.avatar;
    }

    const syncManagers = this.backgroundApi.servicePrimeCloudSync.syncManagers;
    const syncItem = params.skipSaveLocalSyncItem
      ? undefined
      : await syncManagers.wallet.buildSyncItemByDBQuery({
          dbRecord: {
            ...wallet,
            name: walletName,
            avatarInfo,
            avatar: JSON.stringify(avatarInfo),
          },
          // allDevices,
          syncCredential: await syncManagers.wallet.getSyncCredential(),
          isDeleted: false,
          dataTime: await this.timeNow(),
        });

    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      // add or update sync item
      if (syncItem) {
        await this.txAddAndUpdateSyncItems({
          tx,
          items: [syncItem],
        });
      }

      // update wallet name
      await this.txUpdateWallet({
        tx,
        walletId,
        updater: (w) => {
          if (walletName) {
            w.name = walletName;
          }
          if (avatarInfo) {
            w.avatar = JSON.stringify(avatarInfo);
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

  async setWalletDeprecated({
    walletId,
    isDeprecated,
  }: {
    walletId: IDBWalletId;
    isDeprecated: boolean;
  }) {
    const wallet = await this.getWalletSafe({ walletId });
    if (!wallet || wallet.deprecated === isDeprecated) {
      return;
    }
    return this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txUpdateWallet({
        tx,
        walletId,
        updater(w) {
          w.deprecated = isDeprecated;
          return w;
        },
      });
    });
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
          throw new OneKeyLocalError(
            'validateAccountsFields ERROR: account.impl is missing',
          );
        }

        if (account.type === EDBAccountType.VARIANT) {
          if (account.address && !isExternal) {
            throw new OneKeyLocalError(
              'VARIANT account should not set account address',
            );
          }
        }

        if (account.type === EDBAccountType.UTXO) {
          // dnx relPath is empty
          if (!account.relPath && ![COINTYPE_DNX].includes(account.coinType)) {
            throw new OneKeyLocalError('UTXO account should set relPath');
          }
        }

        if (
          accountUtils.isHdWallet({ walletId }) ||
          accountUtils.isHwWallet({ walletId })
        ) {
          if (isNil(account.pathIndex)) {
            throw new OneKeyLocalError('HD account should set pathIndex');
          }
          if (!account.indexedAccountId) {
            throw new OneKeyLocalError(
              'HD account should set indexedAccountId',
            );
          }
        }

        if (
          accountUtils.isImportedWallet({ walletId }) ||
          accountUtils.isWatchingWallet({ walletId })
        ) {
          if (!account.createAtNetwork) {
            throw new OneKeyLocalError(
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
    Array<{
      walletName: string;
      accountName: string;
      accountId: string; // accountId or indexedAccountId
    }>
  > {
    try {
      const info = (
        await Promise.all([
          this.getAddressByNetworkId({ networkId, address }),
          this.getAddressByNetworkImpl({ networkId, normalizedAddress }),
        ])
      ).filter(Boolean);

      if (!isEmpty(info)) {
        const result: {
          walletName: string;
          accountName: string;
          accountId: string;
          order: number;
        }[] = [];
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
              const order = getOrderByWalletType(wallet.type);
              if (
                !accountUtils.isUrlAccountFn({
                  accountId: account?.id,
                })
              ) {
                result.push({
                  walletName: wallet.name,
                  accountName: account.name,
                  accountId: account.id,
                  order,
                });
              }
            }
          } catch (error) {
            errorUtils.autoPrintErrorIgnore(error);
          }
        }
        const resultSorted = [...result].sort((a, b) => a.order - b.order);
        console.log('getAccountNameFromAddress', { resultSorted, result });
        return resultSorted;
      }
      return [];
    } catch (error) {
      errorUtils.autoPrintErrorIgnore(error);
      return [];
    }
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
  }): Promise<{ isOverrideAccounts: boolean; existsAccounts: IDBAccount[] }> {
    this.validateAccountsFields(accounts);

    const wallet = await this.getWallet({ walletId });
    let nextAccountId: number = this.getNextIdsValue({
      nextIds: wallet.nextIds,
      key: 'accountGlobalNum',
      defaultValue: 1,
    });

    const accountDefaultNameMap: {
      [accountId: string]: string;
    } = {};

    const ids = accounts.map((item) => item.id);
    const { records: existsAccountsRecords } = await this.getRecordsByIds({
      name: ELocalDBStoreNames.Account,
      ids,
    });
    const existsAccounts = existsAccountsRecords.filter(Boolean);

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
        const defaultName = accountNameBuilder({
          nextAccountId,
        });
        // auto create account name here
        account.name = defaultName;
        accountDefaultNameMap[account.id] = defaultName;
        // Only for watching, imported, external accounts, HD indexed account names are not handled here
        nextAccountId += 1;
      }
    });

    const syncManager =
      this.backgroundApi.servicePrimeCloudSync.syncManagers.account;

    const existingSyncItemsInfoResult000025394378263443374653 =
      await (async () => {
        return syncManager.buildExistingSyncItemsInfo({
          targets: accounts.map((account) => ({
            targetId: account.id,
            dataType: EPrimeCloudSyncDataType.Account,
            account: { ...account, name: account.name },
          })),
          onExistingSyncItemsInfo: async (existingSyncItemsInfo) => {
            // fix account name by existing sync item
            accounts.forEach((account) => {
              const existingSyncItem = existingSyncItemsInfo[account.id];
              if (existingSyncItem?.syncPayload?.name) {
                account.name = existingSyncItem.syncPayload.name;
              }
            });
          },
          useCreateGenesisTime: async ({ target }) => {
            const accountDefaultName = accountDefaultNameMap[target.account.id];
            return Boolean(
              accountDefaultName && target.account.name === accountDefaultName,
            );
          },
        });
      })();

    // db transaction: add accounts to wallet
    const addResults = await this.withTransaction(
      EIndexedDBBucketNames.account,
      async (tx) => {
        const addResults0 = await syncManager.txWithSyncFlowOfDBRecordCreating({
          tx,
          existingSyncItems:
            existingSyncItemsInfoResult000025394378263443374653.existingSyncItems,
          newSyncItems:
            existingSyncItemsInfoResult000025394378263443374653.newSyncItems,
          runDbTxFn: async () => {
            const firstAccount: IDBAccount | undefined = accounts?.[0];

            const shouldBuildIdHash =
              firstAccount &&
              firstAccount?.pathIndex === 0 &&
              firstAccount?.address &&
              firstAccount?.coinType === COINTYPE_ETH &&
              firstAccount?.indexedAccountId &&
              firstAccount?.path === FIRST_EVM_ADDRESS_PATH;

            // build idHash for account avatar by firstEvmAddress
            if (shouldBuildIdHash) {
              const firstEvmAddress = firstAccount.address.toLowerCase();
              await this.txUpdateWallet({
                tx,
                walletId,
                updater: (w) => {
                  w.firstEvmAddress = firstEvmAddress;
                  return w;
                },
              });
              await this.txUpdateRecords({
                tx,
                name: ELocalDBStoreNames.IndexedAccount,
                ids: [firstAccount?.indexedAccountId].filter(Boolean),
                updater: async (item) => {
                  item.idHash = await this.buildIndexedAccountIdHash({
                    firstEvmAddress,
                    indexedAccountId: item.id,
                    index: firstAccount.pathIndex,
                  });
                  return item;
                },
              });
            }

            let removed = 0;
            if (existsAccounts && existsAccounts.length) {
              // TODO remove and re-add, may cause nextIds not correct,
              // TODO return actual removed count
              await this.txRemoveRecords({
                tx,
                name: ELocalDBStoreNames.Account,
                ids,
                ignoreNotFound: true,
              });

              removed = existsAccounts.length;
            }

            // add account record
            let { added, addedIds } = await this.txAddRecords({
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
                  const newAccountGlobalNum =
                    currentNextAccountId + actualAdded;
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

            // add imported account credential
            if (walletId === WALLET_TYPE_IMPORTED) {
              if (addedIds.length !== 1) {
                throw new OneKeyLocalError(
                  'Only one can be imported at a time into a private key account.',
                );
              }
              if (!importedCredential) {
                throw new OneKeyLocalError(
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

            const isOverrideAccounts = removed > 0 && actualAdded === 0;

            return {
              isOverrideAccounts,
              existsAccounts,
            };

            // TODO should add accountId to wallet.accounts or wallet.indexedAccounts?
          },
        });
        return addResults0;
      },
    );

    // saveAccountAddresses
    if (allAccountsBelongToNetworkId) {
      for (const account of accounts) {
        try {
          void this.saveAccountAddresses({
            networkId: allAccountsBelongToNetworkId,
            account: account as INetworkAccount,
          });
        } catch (error) {
          //
        }
      }
    }

    appEventBus.emit(EAppEventBusNames.AddDBAccountsToWallet, {
      walletId,
      accounts,
    });
    return addResults;
  }

  async saveTonImportedAccountMnemonic({
    accountId,
    rs,
  }: {
    accountId: string;
    rs: IBip39RevealableSeedEncryptHex;
  }) {
    if (!accountUtils.isImportedAccount({ accountId })) {
      throw new OneKeyLocalError(
        'saveTonMnemonic ERROR: Not a imported account',
      );
    }

    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Credential,
        records: [
          {
            id: accountUtils.buildTonMnemonicCredentialId({ accountId }),
            credential: rs,
          },
        ],
        skipIfExists: true,
      });
    });
  }

  async updateWalletsBackupStatus(walletsBackedUpStatusMap: {
    [walletId: string]: {
      isBackedUp?: boolean;
    };
  }): Promise<void> {
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Wallet,
        ids: Object.keys(walletsBackedUpStatusMap),
        updater: (record) => {
          const isBackedUp = walletsBackedUpStatusMap[record.id]?.isBackedUp;
          if (isBackedUp === undefined) {
            return record;
          }
          record.backuped = isBackedUp;
          return record;
        },
      });
    });
  }

  // #endregion

  // #region ---------------------------------------------- account

  async getSingletonAccountsOfWallet({
    walletId,
  }: {
    walletId: IDBWalletIdSingleton;
  }): Promise<{
    accounts: IDBAccount[];
    removedAccountIds?: string[];
  }> {
    const wallet = await this.getWalletSafe({ walletId });
    if (!wallet || !wallet?.accounts?.length) {
      // if (!wallet) {
      return { accounts: [] };
    }
    let { accounts } = await this.getAllAccounts({
      ids: wallet.accounts, // // filter by ids for better performance
    });

    let removedAccountIds: string[] = [];
    if (
      wallet?.accounts?.length &&
      wallet?.accounts?.length !== accounts?.length
    ) {
      removedAccountIds = wallet.accounts.filter(
        (id) => !accounts.some((item) => item.id === id),
      );
    }

    accounts = accounts.filter(
      (item) => item && !accountUtils.isUrlAccountFn({ accountId: item.id }),
    );
    accounts = accounts.map((account, walletAccountsIndex) =>
      this.refillAccountInfo({
        account,
        walletAccountsIndex,
        indexedAccount: undefined,
      }),
    );
    accounts = accounts.sort((a, b) =>
      natsort({ insensitive: true })(a.accountOrder ?? 0, b.accountOrder ?? 0),
    );

    return {
      removedAccountIds,
      accounts,
    };
  }

  async getAccountsInSameIndexedAccountId({
    indexedAccountId,
  }: {
    indexedAccountId: string;
  }) {
    const indexedAccount = await this.getIndexedAccount({
      id: indexedAccountId,
    });
    const allDbAccounts = (await this.getAllAccounts()).accounts;
    const accounts = allDbAccounts
      .filter(
        (account) =>
          account.indexedAccountId === indexedAccountId && indexedAccountId,
      )
      .map((account) => this.refillAccountInfo({ account, indexedAccount }));
    return { accounts, allDbAccounts };
  }

  async getAccount({ accountId }: { accountId: string }): Promise<IDBAccount> {
    const perf = perfUtils.createPerf({
      name: EPerformanceTimerLogNames.localDB__getAccount,
      params: { accountId },
    });

    perf.markStart('getRecordById');
    const account = await this.getRecordById({
      name: ELocalDBStoreNames.Account,
      id: accountId,
    });
    perf.markEnd('getRecordById');

    perf.markStart('getIndexedAccountByAccount');
    const indexedAccount = await this.getIndexedAccountByAccount({
      account,
    });
    perf.markEnd('getIndexedAccountByAccount');

    perf.markStart('refillAccountInfo');
    const result: IDBAccount = this.refillAccountInfo({
      account,
      indexedAccount,
    });
    perf.markEnd('refillAccountInfo');

    perf.done();
    return result;
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

  refillAccountOrderInfo({
    account,
    walletAccountsIndex,
  }: {
    account: IDBAccount;
    walletAccountsIndex?: number; // wallet.accounts array index
  }) {
    account.accountOrder = account?.accountOrderSaved;
    if (!isNil(walletAccountsIndex)) {
      account.accountOrder =
        account?.accountOrderSaved ?? walletAccountsIndex + 1;
    }
  }

  refillAccountInfo({
    account,
    indexedAccount,
    walletAccountsIndex,
  }: {
    account: IDBAccount;
    // TODO update name here
    indexedAccount: IDBIndexedAccount | undefined;
    walletAccountsIndex?: number; // wallet.accounts array index
  }) {
    this.refillAccountOrderInfo({
      account,
      walletAccountsIndex,
    });

    const externalAccount = account as IDBExternalAccount;
    if (externalAccount && externalAccount.connectionInfoRaw) {
      externalAccount.connectionInfo = JSON.parse(
        externalAccount.connectionInfoRaw,
      );
    }
    // fix account name by indexedAccount name
    if (indexedAccount) {
      account.name = indexedAccount.name;
    }
    return account;
  }

  async updateAccountOrder({
    accountId,
    order,
  }: {
    accountId: string;
    order: number;
  }) {
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Account,
        ids: [accountId],
        updater(item) {
          if (!isNil(order)) {
            item.accountOrderSaved = order;
          }
          return item;
        },
      });
    });
  }

  async updateAccountXpub(accountsXpubMap: {
    [accountId: string]: {
      xpub: string;
      xpubSegwit: string;
    };
  }) {
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Account,
        ids: Object.keys(accountsXpubMap),
        updater(item) {
          const accountXpub = accountsXpubMap[item.id];
          if (accountXpub && 'xpub' in item && 'xpubSegwit' in item) {
            const { xpub, xpubSegwit } = accountXpub;
            if (xpub) {
              item.xpub = xpub;
            }
            if (xpubSegwit) {
              item.xpubSegwit = xpubSegwit;
            }
          }
          return item;
        },
      });
    });
  }

  async getAllDevices(): Promise<{ devices: IDBDevice[] }> {
    const cacheKey = 'allDbDevices';
    const allDevicesInCache = this.getAllRecordsByCache<IDBDevice>(cacheKey);
    if (allDevicesInCache && allDevicesInCache.length) {
      return { devices: allDevicesInCache };
    }
    const { records: devices } = await this.getAllRecords({
      name: ELocalDBStoreNames.Device,
    });
    devices.forEach((item) => this.refillDeviceInfo({ device: item }));
    this.dbAllRecordsCache.set(cacheKey, devices);
    return { devices };
  }

  async getAllWallets(): Promise<{
    wallets: IDBWallet[];
  }> {
    const cacheKey = 'allDbWallets';
    const allWalletsInCache = this.getAllRecordsByCache<IDBWallet>(cacheKey);
    if (allWalletsInCache && allWalletsInCache.length) {
      return { wallets: allWalletsInCache };
    }
    const { records: wallets } = await this.getAllRecords({
      name: ELocalDBStoreNames.Wallet,
    });
    this.dbAllRecordsCache.set(cacheKey, wallets);
    return {
      wallets,
    };
  }

  // async getAllWallets({
  //   refillWalletInfo,
  // }: IDBGetAllWalletsParams = {}): Promise<{
  //   wallets: IDBWallet[];
  // }> {
  //   let { records } = await this.getAllRecords({
  //     name: ELocalDBStoreNames.Wallet,
  //   });
  //   if (refillWalletInfo) {
  //     const { devices: allDevices } = await this.getAllDevices();
  //     const refilledWalletsCache: {
  //       [walletId: string]: IDBWallet;
  //     } = {};
  //     records = await Promise.all(
  //       records.map((wallet) =>
  //         this.refillWalletInfo({ wallet, refilledWalletsCache, allDevices }),
  //       ),
  //     );
  //   }
  //   return {
  //     wallets: records,
  //   };
  // }

  async getAllIndexedAccounts(): Promise<{
    indexedAccounts: IDBIndexedAccount[];
  }> {
    const cacheKey = 'allDbIndexedAccounts';
    const allIndexedAccountsInCache =
      this.getAllRecordsByCache<IDBIndexedAccount>(cacheKey);
    if (allIndexedAccountsInCache && allIndexedAccountsInCache.length) {
      return { indexedAccounts: allIndexedAccountsInCache };
    }
    const { records: indexedAccounts } = await this.getAllRecords({
      name: ELocalDBStoreNames.IndexedAccount,
    });
    this.dbAllRecordsCache.set(cacheKey, indexedAccounts);
    return { indexedAccounts };
  }

  async getAllAccounts({ ids }: { ids?: string[] } = {}): Promise<{
    accounts: IDBAccount[];
  }> {
    const cacheKey = 'allDbAccounts';
    if (!ids) {
      const allDbAccountsInCache =
        this.getAllRecordsByCache<IDBAccount>(cacheKey);
      if (allDbAccountsInCache && allDbAccountsInCache?.length) {
        return { accounts: allDbAccountsInCache };
      }
    }
    let accounts: IDBAccount[] = [];
    if (ids) {
      const { records } = await this.getRecordsByIds({
        name: ELocalDBStoreNames.Account,
        ids,
      });
      accounts = records.filter(Boolean);
    } else {
      const { records } = await this.getAllRecords({
        name: ELocalDBStoreNames.Account,
      });
      accounts = records.filter(Boolean);
    }
    if (!ids) {
      this.dbAllRecordsCache.set(cacheKey, accounts);
    }
    return { accounts };
  }

  async removeIndexedAccounts({
    indexedAccounts,
  }: {
    indexedAccounts: IDBIndexedAccount[];
  }) {
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txRemoveRecords({
        tx,
        name: ELocalDBStoreNames.IndexedAccount,
        ids: indexedAccounts.map((item) => item.id),
      });
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
    const syncManagers = this.backgroundApi.servicePrimeCloudSync.syncManagers;
    const indexedAccount = await this.getIndexedAccountSafe({
      id: indexedAccountId,
    });

    const getSyncItemKeyFn = async () => {
      let syncItemKey: string | undefined;
      if (indexedAccount) {
        const target =
          await syncManagers.indexedAccount.buildSyncTargetByDBQuery({
            dbRecord: indexedAccount,
          });
        const keyInfo =
          await syncManagers.indexedAccount.buildSyncKeyAndPayload({
            target,
          });
        syncItemKey = keyInfo.key;
      }
      return syncItemKey;
    };
    // const syncItemKey = await getSyncItemKeyFn();

    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txRemoveRecords({
        tx,
        name: ELocalDBStoreNames.IndexedAccount,
        ids: [indexedAccountId],
      });

      // keep sync item for same mnemonic wallet accounts creation
      // if (syncItemKey) {
      //   await this.txRemoveCloudSyncPoolItems({
      //     tx,
      //     keys: [syncItemKey],
      //   });
      // }
    });
  }

  async removeAccountsByIds({ ids }: { ids: string[] }) {
    const walletToRemovedAccountsMap: Record<string, string[]> = {};

    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txRemoveRecords({
        tx,
        name: ELocalDBStoreNames.Account,
        ignoreNotFound: true,
        ids: ids.map((id) => {
          const accountId = id;
          const walletId = accountUtils.getWalletIdFromAccountId({
            accountId,
          });

          if (walletId) {
            walletToRemovedAccountsMap[walletId] = [
              ...(walletToRemovedAccountsMap[walletId] || []),
              accountId,
            ];
          }
          return accountId;
        }),
      });
    });

    const mapEntries = Object.entries(walletToRemovedAccountsMap);
    if (mapEntries.length > 0) {
      await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
        for (const [walletId, accountIds] of mapEntries) {
          if (!walletId || !accountIds || accountIds.length === 0) {
            // eslint-disable-next-line no-continue
            continue;
          }
          await this.txUpdateWallet({
            tx,
            walletId,
            updater: (wallet) => {
              wallet.accounts = (wallet.accounts || []).filter(
                (id) => !accountIds.includes(id),
              );
              return wallet;
            },
          });
        }
      });
    }
  }

  async removeAccounts({ accounts }: { accounts: IDBAccount[] }) {
    return this.removeAccountsByIds({
      ids: accounts.map((item) => item.id),
    });
  }

  async removeAccount({
    accountId,
    walletId,
  }: {
    accountId: string;
    walletId: string;
  }): Promise<void> {
    const syncManagers = this.backgroundApi.servicePrimeCloudSync.syncManagers;
    const account = await this.getAccountSafe({
      accountId,
    });
    let syncItemKey: string | undefined;
    if (account) {
      const target = await syncManagers.account.buildSyncTargetByDBQuery({
        dbRecord: account,
      });
      const keyInfo = await syncManagers.account.buildSyncKeyAndPayload({
        target,
      });
      syncItemKey = keyInfo.key;
    }

    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
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

    if (syncItemKey) {
      await this.removeCloudSyncPoolItems({ keys: [syncItemKey] });
    }
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
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
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

  async ensureAccountNameNotDuplicate(
    params: IDBEnsureAccountNameNotDuplicateParams,
  ): Promise<void> {
    const { walletId, name, selfAccountOrIndexedAccountId } = params;
    let currentAccounts: IDBIndexedAccount[] | IDBAccount[] = [];
    const isOthersWallet = accountUtils.isOthersWallet({ walletId });
    if (!isOthersWallet) {
      try {
        ({ accounts: currentAccounts } = await this.getIndexedAccountsOfWallet({
          walletId,
        }));
      } catch (error) {
        //
      }
    }
    if (isOthersWallet) {
      try {
        ({ accounts: currentAccounts } =
          await this.getSingletonAccountsOfWallet({
            walletId: walletId as IDBWalletIdSingleton,
          }));
      } catch (error) {
        //
      }
    }
    const duplicatedNameAccount = currentAccounts.find(
      (item) => item.name === name && item.id !== selfAccountOrIndexedAccountId,
    );
    if (duplicatedNameAccount) {
      throw new RenameDuplicateNameError();
    }
  }

  async emitRenameDBAccountsEvent(params: IDBSetAccountNameParams) {
    await timerUtils.setTimeoutPromised(async () => {
      let accounts: IDBAccount[] = [];

      if (params.indexedAccountId) {
        // TODO low performance
        accounts = (
          await this.getAccountsInSameIndexedAccountId({
            indexedAccountId: params.indexedAccountId,
          })
        ).accounts;
      }
      if (params.accountId) {
        const account = await this.getAccountSafe({
          accountId: params.accountId,
        });
        accounts = [...accounts, account].filter(Boolean);
      }
      appEventBus.emit(EAppEventBusNames.RenameDBAccounts, {
        accounts,
      });
    });
  }

  async setAccountName(params: IDBSetAccountNameParams): Promise<void> {
    if (params.name && params.shouldCheckDuplicate) {
      const id = params.indexedAccountId ?? params.accountId;
      if (params.indexedAccountId && params.accountId) {
        throw new OneKeyLocalError(
          'ensureAccountNameNotDuplicate ERROR: indexedAccountId and accountId should not be set at the same time',
        );
      }
      if (id) {
        const walletId = accountUtils.getWalletIdFromAccountId({
          accountId: id,
        });
        await this.ensureAccountNameNotDuplicate({
          walletId,
          name: params.name,
          selfAccountOrIndexedAccountId: id,
        });
      }
    }

    const syncManagers = this.backgroundApi.servicePrimeCloudSync.syncManagers;
    let syncItem: IDBCloudSyncItem | undefined;
    if (!params.skipSaveLocalSyncItem) {
      const now = await this.timeNow();
      if (params.accountId) {
        const account = await this.getAccountSafe({
          accountId: params.accountId,
        });
        if (account) {
          syncItem = await syncManagers.account.buildSyncItemByDBQuery({
            syncCredential: await syncManagers.account.getSyncCredential(),
            dbRecord: { ...account, name: params.name || account.name },
            isDeleted: false,
            dataTime: now,
          });
        }
      }
      if (params.indexedAccountId) {
        const indexedAccount = await this.getIndexedAccountSafe({
          id: params.indexedAccountId,
        });
        if (indexedAccount) {
          syncItem = await syncManagers.indexedAccount.buildSyncItemByDBQuery({
            syncCredential:
              await syncManagers.indexedAccount.getSyncCredential(),
            dbRecord: {
              ...indexedAccount,
              name: params.name || indexedAccount.name,
            },
            isDeleted: false,
            dataTime: now,
          });
        }
      }
    }

    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      // add or update sync item
      if (syncItem) {
        await this.txAddAndUpdateSyncItems({
          tx,
          items: [syncItem],
        });
      }

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

    void this.emitRenameDBAccountsEvent(params);
  }

  // #endregion

  // #region ---------------------------------------------- device

  async getSameDeviceByUUIDEvenIfReset(uuid: string) {
    const { devices } = await this.getAllDevices();
    return devices.find((item) => uuid && item.uuid === uuid);
  }

  async getExistingDevice({
    // required: After resetting, the device will be considered as a new one.
    //      use the getSameDeviceByUUIDEvenIfReset() method if you want to find the same device even if it is reset.
    rawDeviceId,
    uuid,
    getFirstEvmAddressFn,
  }: {
    rawDeviceId: string;
    uuid: string;
    getFirstEvmAddressFn?: () => Promise<string | null>;
  }): Promise<IDBDevice | undefined> {
    if (!rawDeviceId) {
      return undefined;
    }
    const { devices } = await this.getAllDevices();
    const sameDeviceIdAndUuidDevice = devices.find((item) => {
      let deviceIdMatched = rawDeviceId && item.deviceId === rawDeviceId;
      if (uuid && item.uuid) {
        deviceIdMatched = deviceIdMatched && item.uuid === uuid;
      }
      return deviceIdMatched;
    });
    if (sameDeviceIdAndUuidDevice) {
      return sameDeviceIdAndUuidDevice;
    }

    // find same uuid device by first evm address
    if (!getFirstEvmAddressFn || !uuid) {
      return undefined;
    }

    const sameUuidDevices = devices.filter((item) => item.uuid === uuid);
    if (sameUuidDevices.length === 0) {
      return undefined;
    }

    const firstEvmAddress = await getFirstEvmAddressFn();
    if (!firstEvmAddress) {
      return undefined;
    }
    const { wallets } = await this.getAllWallets();
    const matchedWallets = wallets.filter(
      (item) =>
        accountUtils.isHwWallet({
          walletId: item.id,
        }) &&
        !accountUtils.isHwHiddenWallet({
          wallet: item,
        }) &&
        sameUuidDevices.some((device) => device.id === item.associatedDevice) &&
        (item.firstEvmAddress ?? '').toLowerCase() ===
          firstEvmAddress.toLowerCase(),
    );
    if (matchedWallets.length === 0) {
      return undefined;
    }

    // sort by walletNo
    matchedWallets.sort((a, b) => (b.walletNo ?? 0) - (a.walletNo ?? 0));
    const associatedWallet = matchedWallets[0];
    return sameUuidDevices.find(
      (device) => device.id === associatedWallet.associatedDevice,
    );
  }

  async getWalletDeviceSafe({
    dbWallet,
    walletId,
    allDevices,
  }: {
    dbWallet?: IDBWallet;
    walletId: string;
    allDevices?: IDBDevice[];
  }): Promise<IDBDevice | undefined> {
    try {
      return await this.getWalletDevice({ allDevices, walletId, dbWallet });
    } catch (error) {
      if (
        !accountUtils.isHwWallet({
          walletId,
        }) &&
        !accountUtils.isQrWallet({
          walletId,
        })
      ) {
        errorUtils.autoPrintErrorIgnore(error);
      }

      return undefined;
    }
  }

  async getWalletDevice({
    walletId,
    dbWallet,
    allDevices,
  }: {
    walletId: string;
    dbWallet?: IDBWallet;
    allDevices?: IDBDevice[];
  }): Promise<IDBDevice> {
    const wallet =
      dbWallet ||
      (await this.getWallet({
        walletId,
      }));

    if (wallet.associatedDevice) {
      const deviceFromAllDevices = allDevices?.find(
        (item) => item.id === wallet.associatedDevice,
      );
      if (deviceFromAllDevices) {
        return deviceFromAllDevices;
      }
      return this.getDevice(wallet.associatedDevice);
    }
    throw new OneKeyLocalError(
      `wallet associatedDevice not found:${wallet?.id || walletId}`,
    );
  }

  async getDeviceByQuery({
    connectId,
    featuresDeviceId,
    features,
  }: {
    connectId?: string;
    featuresDeviceId?: string; // rawDeviceId
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
        // Match any of the connectId fields (legacy behavior + new fields)
        mergePredicate(
          item.connectId === connectId ||
            item.usbConnectId === connectId ||
            item.bleConnectId === connectId,
        );
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

  async getDeviceSafe(dbDeviceId: string): Promise<IDBDevice | undefined> {
    try {
      return await this.getDevice(dbDeviceId);
    } catch (error) {
      return undefined;
    }
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
    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
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

  async getHardwareHomeScreen({ deviceId }: { deviceId: string }) {
    return this.withTransaction(EIndexedDBBucketNames.archive, async (tx) => {
      const ids = await this.txGetRecordIds({
        name: ELocalDBStoreNames.HardwareHomeScreen,
        tx,
      });
      const filteredIds = ids.filter((id) => id.startsWith(deviceId));
      const { records } = await this.txGetRecordsByIds({
        name: ELocalDBStoreNames.HardwareHomeScreen,
        ids: filteredIds,
        tx,
      });
      return records
        .filter((item) => item !== null && item !== undefined)
        .filter((item) => item.deviceId === deviceId)
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    });
  }

  async addHardwareHomeScreen({
    homeScreen,
  }: {
    homeScreen: IDeviceHomeScreen;
  }) {
    return this.withTransaction(EIndexedDBBucketNames.archive, async (tx) => {
      const id = `${homeScreen.deviceId}--${homeScreen.name}`;
      await this.txAddRecords({
        name: ELocalDBStoreNames.HardwareHomeScreen,
        tx,
        records: [
          {
            ...homeScreen,
            id,
            createdAt: await this.timeNow(),
          },
        ],
      });

      return id;
    });
  }

  async deleteHardwareHomeScreen({ homeScreenId }: { homeScreenId: string }) {
    await this.withTransaction(EIndexedDBBucketNames.archive, async (tx) => {
      await this.txRemoveRecords({
        name: ELocalDBStoreNames.HardwareHomeScreen,
        tx,
        ids: [homeScreenId],
        ignoreNotFound: true,
      });
    });
  }

  // #endregion

  // #region ---------------------------------------------- account address

  // Account address batch cache for saveAccountAddresses
  private accountAddressCache: Array<{
    networkId: string;
    account: INetworkAccount;
  }> = [];

  // Batch process account addresses from cache
  private _saveAccountAddressesBatchByCache = debounce(
    async () => {
      if (this.accountAddressCache.length === 0) {
        return;
      }

      const cacheToProcess = [...this.accountAddressCache];
      this.accountAddressCache = [];

      // Group records for batch processing
      const recordPairsToUpdate: Record<
        string,
        {
          recordPair: ILocalDBTxGetRecordByIdResult<ELocalDBStoreNames.Address>;
          walletId: string;
          accountId: string;
        }
      > = {};
      const recordsToInsert: Record<
        string,
        {
          id: string;
          wallets: { [walletId: string]: string };
        }
      > = {};

      await this.withTransaction(EIndexedDBBucketNames.address, async (tx) => {
        const existingAddressRecordPairs: Record<
          string,
          ILocalDBTxGetRecordByIdResult<ELocalDBStoreNames.Address>
        > = {};
        for (const { networkId, account } of cacheToProcess) {
          const accountId = account.id;
          const { indexedAccountId, address, addressDetail, type } = account;

          let id = address ? `${networkId}--${address}` : '';
          if (type === EDBAccountType.SIMPLE) {
            const impl = networkUtils.getNetworkImpl({ networkId });
            const normalizedAddress =
              addressDetail?.normalizedAddress || address;
            id = normalizedAddress ? `${impl}--${normalizedAddress}` : '';
          }
          if (!id) {
            const variantAccount = account as IDBVariantAccount | undefined;
            const variantAddress = variantAccount?.addresses?.[networkId];
            if (variantAddress && networkId) {
              id = `${networkId}--${variantAddress}`;
            }
            if (!id) {
              // eslint-disable-next-line no-continue
              continue;
            }
          }

          const walletId = accountUtils.getWalletIdFromAccountId({
            accountId,
          });

          try {
            const recordPair =
              existingAddressRecordPairs[id] ||
              (await this.txGetRecordById({
                tx,
                name: ELocalDBStoreNames.Address,
                id,
              }));
            existingAddressRecordPairs[id] = recordPair;

            const record = recordPair?.[0];
            if (record && recordPair) {
              const newAccountId = indexedAccountId ?? accountId;
              const oldAccountId = record?.wallets?.[walletId];
              if (newAccountId && oldAccountId !== newAccountId && record?.id) {
                recordPairsToUpdate[record.id] = {
                  recordPair,
                  accountId: newAccountId,
                  walletId,
                };
              }
            } else {
              recordsToInsert[id] = {
                id,
                wallets: {
                  ...recordsToInsert?.[id]?.wallets,
                  [walletId]: indexedAccountId ?? accountId,
                },
              };
            }
          } catch (error) {
            // If record doesn't exist, add to inserts
            recordsToInsert[id] = {
              id,
              wallets: {
                ...recordsToInsert?.[id]?.wallets,
                [walletId]: indexedAccountId ?? accountId,
              },
            };
          }
        }

        // Batch update existing records
        if (Object.keys(recordPairsToUpdate).length > 0) {
          try {
            await this.txUpdateRecords({
              tx,
              name: ELocalDBStoreNames.Address,
              recordPairs: Object.values(recordPairsToUpdate).map(
                (r) => r.recordPair,
              ),
              updater: (r) => {
                // Find corresponding cache item for this record
                const cacheItem = recordPairsToUpdate?.[r?.id];
                if (cacheItem) {
                  const { walletId, accountId } = cacheItem;
                  const newAccountId = accountId;
                  if (!r.wallets) {
                    r.wallets = {};
                  }
                  if (walletId && newAccountId) {
                    r.wallets[walletId] = newAccountId;
                  }
                }
                return r;
              },
            });
          } catch (error) {
            console.error('Error updating records', error);
          }
        }

        // Batch insert new records
        if (Object.keys(recordsToInsert).length > 0) {
          try {
            await this.txAddRecords({
              tx,
              name: ELocalDBStoreNames.Address,
              records: Object.values(recordsToInsert),
            });
          } catch (error) {
            console.error('Error adding records', error);
          }
        }
      });
    },
    5000,
    {
      leading: false,
      trailing: true,
    },
  );

  async saveAccountAddresses({
    networkId,
    account,
  }: {
    networkId: string;
    account: INetworkAccount; // TODO support accounts array
  }) {
    if (!networkId) {
      return;
    }
    if (networkUtils.isAllNetwork({ networkId })) {
      return;
    }
    if (accountUtils.isAllNetworkMockAccount({ accountId: account.id })) {
      return;
    }
    if (accountUtils.isUrlAccountFn({ accountId: account.id })) {
      return;
    }

    // console.log('saveAccountAddresses', networkId, account?.address);

    // Add to cache instead of direct DB operations
    this.accountAddressCache.push({ networkId, account });

    // Trigger debounced batch processing
    return this._saveAccountAddressesBatchByCache();
  }

  // #endregion

  // #region ---------------------------------------------- signature record

  async addSignedMessage(params: ICreateSignedMessageParams) {
    const ctx = await this.getContext();
    await this.withTransaction(EIndexedDBBucketNames.archive, async (tx) => {
      await this.txAddRecords({
        name: ELocalDBStoreNames.SignedMessage,
        tx,
        records: [
          {
            ...params,
            id: String(ctx.nextSignatureMessageId),
            createdAt: await this.timeNow(),
          },
        ],
      });
    });

    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await this.txUpdateContext({
        tx,
        updater: (r) => {
          // TODO save nextId to archive bucket store
          r.nextSignatureMessageId += 1;
          return r;
        },
      });
    });
  }

  async addSignedTransaction(params: ICreateSignedTransactionParams) {
    const { data, ...rest } = params;
    const dataStringify = JSON.stringify(data);
    const ctx = await this.getContext();
    await this.withTransaction(EIndexedDBBucketNames.archive, async (tx) => {
      await this.txAddRecords({
        name: ELocalDBStoreNames.SignedTransaction,
        tx,
        records: [
          {
            ...rest,
            dataStringify,
            id: String(ctx.nextSignatureTransactionId),
            createdAt: await this.timeNow(),
          },
        ],
      });
    });

    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
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
    const ctx = await this.getContext();

    await this.withTransaction(EIndexedDBBucketNames.archive, async (tx) => {
      await this.txAddRecords({
        name: ELocalDBStoreNames.ConnectedSite,
        tx,
        records: [
          {
            ...params,
            id: String(ctx.nextConnectedSiteId),
            createdAt: await this.timeNow(),
          },
        ],
      });
    });

    await this.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
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
    const allSignedMessage = await this.getAllRecords({
      name: ELocalDBStoreNames.SignedMessage,
    });
    await this.withTransaction(EIndexedDBBucketNames.archive, async (tx) => {
      await this.txRemoveRecords({
        name: ELocalDBStoreNames.SignedMessage,
        tx,
        ids: allSignedMessage.records.map((item) => item.id),
      });
    });
  }

  async removeAllSignedTransaction() {
    const allSignedTransaction = await this.getAllRecords({
      name: ELocalDBStoreNames.SignedTransaction,
    });
    await this.withTransaction(EIndexedDBBucketNames.archive, async (tx) => {
      await this.txRemoveRecords({
        name: ELocalDBStoreNames.SignedTransaction,
        tx,
        ids: allSignedTransaction.records.map((item) => item.id),
      });
    });
  }

  async removeAllConnectedSite() {
    const allConnectedSite = await this.getAllRecords({
      name: ELocalDBStoreNames.ConnectedSite,
    });
    await this.withTransaction(EIndexedDBBucketNames.archive, async (tx) => {
      await this.txRemoveRecords({
        name: ELocalDBStoreNames.ConnectedSite,
        tx,
        ids: allConnectedSite.records.map((item) => item.id),
      });
    });
  }

  // #endregion

  // #region ---------------------------------------------- demo

  async demoGetDbContext() {
    const c = await this.getContext();

    const ctx = await this.withTransaction(
      EIndexedDBBucketNames.account,
      async (tx) => {
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
          recordPairs2: recordPairs2.filter(Boolean).map((r) => r[0]),
        };
      },
    );

    // const ctx = await localDb.getContext();
    return ctx;
  }

  async demoDbUpdateUUID() {
    const ctx = await this.withTransaction(
      EIndexedDBBucketNames.account,
      async (tx) => {
        await this.txUpdateContext({
          tx,
          updater: (r) => {
            r.backupUUID = generateUUID();
            return Promise.resolve(r);
          },
        });

        // await wait(5000);
        // throw new OneKeyLocalError('test error');

        await this.txUpdateWallet({
          tx,
          walletId: WALLET_TYPE_WATCHING,
          updater: async (r) => {
            r.name = `hello world: ${await this.timeNow()}`;
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
      },
    );

    // const ctx = await localDb.getContext();
    return ctx;
  }

  async demoDbUpdateUUIDFixed() {
    const ctx = await this.withTransaction(
      EIndexedDBBucketNames.account,
      async (tx) => {
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
      },
    );

    // const ctx = await localDb.getContext();
    return ctx;
  }

  async demoAddRecord1() {
    const ctx = await this.withTransaction(
      EIndexedDBBucketNames.account,
      async (tx) => {
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
      },
    );

    // const ctx = await localDb.getContext();
    return ctx;
  }

  async demoRemoveRecord1() {
    const ctx = await this.withTransaction(
      EIndexedDBBucketNames.account,
      async (tx) => {
        const { recordPairs } = await this.txGetAllRecords({
          tx,
          name: ELocalDBStoreNames.Credential,
        });
        await Promise.all(
          recordPairs.filter(Boolean).map((r) =>
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
          recordPairs: recordPairs.filter(Boolean).map((r) => r[0]),
          recordPairs2: recordPairs2.filter(Boolean).map((r) => r[0]),
          // c,
          // credential: c.credential,
        };
      },
    );

    // const ctx = await localDb.getContext();
    return ctx;
  }

  // TODO long time logic, multiple transaction
  async demoUpdateCredentialRecord() {
    const ctx = await this.withTransaction(
      EIndexedDBBucketNames.account,
      async (tx) => {
        const { recordPairs } = await this.txGetAllRecords({
          tx,
          name: ELocalDBStoreNames.Credential,
        });
        await Promise.all(
          recordPairs.filter(Boolean).map((r) =>
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
        // throw new OneKeyLocalError('failed');

        return {
          recordPairs: recordPairs.filter(Boolean).map((r) => r[0]),
          recordPairs2: recordPairs2.filter(Boolean).map((r) => r[0]),
          // c,
          // credential: c.credential,
        };
      },
    );

    // const ctx = await localDb.getContext();
    return ctx;
  }

  async demoTestTransactionAutoCommit() {
    const ctx = await this.withTransaction(
      EIndexedDBBucketNames.account,
      async (tx) => {
        let _ctx = await this.txGetContext({ tx });
        console.log('demoTestTransactionAutoCommit>>>>>>> 1', _ctx);

        const verifyString = await encryptVerifyString({
          password: 'hello-world',
          allowRawPassword: true,
        });

        console.log('demoTestTransactionAutoCommit>>>>>>> 2', _ctx);
        _ctx = await this.txGetContext({ tx });
        console.log('demoTestTransactionAutoCommit>>>>>>> 3', _ctx);

        await this.txUpdateContext({
          tx,
          updater: (r) => {
            r.backupUUID = `1111: ${new Date().toLocaleTimeString()}`;
            return Promise.resolve(r);
          },
        });

        if (true) throw new OneKeyLocalError('test error');

        const ctxById = await this.txGetRecordById({
          tx,
          name: ELocalDBStoreNames.Context,
          id: `${DB_MAIN_CONTEXT_ID}-1111`,
        });
        console.log('demoTestTransactionAutoCommit>>>>>>> 3.1', ctxById);

        // TODO 如果事务提前提交，之前的数据改动会回滚吗？
        // globalThis?.crypto?.subtle cause transaction commit immediately
        if (globalThis?.crypto?.subtle) {
          // const hash = await globalThis.crypto.subtle.digest(
          //   'SHA-256',
          //   bufferUtils.toBuffer('hello-world', 'utf-8'),
          // );
        }

        _ctx = await this.txGetContext({ tx });
        console.log('demoTestTransactionAutoCommit>>>>>>> 4', _ctx);

        await this.txUpdateContext({
          tx,
          updater: (r) => {
            r.backupUUID = `2222: ${new Date().toLocaleTimeString()}`;
            return Promise.resolve(r);
          },
        });

        _ctx = await this.txGetContext({ tx });
        console.log('demoTestTransactionAutoCommit>>>>>>> 5', _ctx);
        return _ctx;
      },
    );

    return ctx;
  }

  // #endregion
}
