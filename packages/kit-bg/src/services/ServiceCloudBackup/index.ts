import { deviceName, osName } from 'expo-device';

import {
  decryptImportedCredential,
  encryptImportedCredential,
  encryptRevealableSeed,
} from '@onekeyhq/core/src/secret';
import { decrypt, encrypt } from '@onekeyhq/core/src/secret/encryptors/aes256';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { cloudBackupPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import * as CloudFs from '@onekeyhq/shared/src/cloudfs';
import {
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import {
  generateUUID,
  getContactUUID,
  getHDAccountUUID,
  getImportedAccountUUID,
  getWatchingAccountUUID,
} from '@onekeyhq/shared/src/utils/miscUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import ServiceBase from '../ServiceBase';

import { ERestoreResult } from './types';
import { filterWillRemoveBackupList } from './utils/BackupTimeStrategyUtils';

import type {
  IBackupData,
  IImportableHDWallet,
  IMetaDataObject,
  IPrivateBackupData,
  IPublicBackupData,
} from './types';

const { shortenAddress } = accountUtils;

const CLOUD_FLODER_NAME = 'onekey_backup_V5/';
const CLOUD_METADATA_FILE_NAME = 'metadata.json';

export const HDWALLET_BACKUP_VERSION = 1;
export const IMPORTED_ACCOUNT_BACKUP_VERSION = 1;
export const WATCHING_ACCOUNT_BACKUP_VERSION = 1;

@backgroundClass()
class ServiceCloudBackup extends ServiceBase {
  private backupUUID = '';

  private deviceInfo = {
    osName: osName ?? 'unknown',
    deviceName: deviceName ?? 'unknown',
  };

  private getBackupPath(filename: string) {
    return `${CLOUD_FLODER_NAME}${filename}`;
  }

  private getTempFilePath(filename: string) {
    if (!RNFS) return;
    return `${RNFS.DocumentDirectoryPath ?? ''}/${filename}`;
  }

  @backgroundMethod()
  async getDataForBackup(password: string): Promise<IBackupData> {
    const { serviceAccount, serviceAddressBook, serviceDiscovery } =
      this.backgroundApi;
    const publicBackupData: IPublicBackupData = {
      contacts: {},
      importedAccounts: {},
      watchingAccounts: {},
      HDWallets: {},
      discoverBookmarks: [],
    };
    const privateBackupData: IPrivateBackupData = {
      contacts: {},
      discoverBookmarks: [],
      credentials: password ? await serviceAccount.dumpCredentials() : {},
      importedAccounts: {},
      watchingAccounts: {},
      wallets: {},
    };
    const { version } = platformEnv;
    const contacts = await serviceAddressBook.getSafeRawItems();

    contacts.forEach((contact) => {
      const contactUUID = getContactUUID(contact);
      privateBackupData.contacts[contactUUID] = contact;
      publicBackupData.contacts[contactUUID] = {
        ...contact,
        address: shortenAddress({ address: contact.address }),
      };
    });

    const bookmarks = await serviceDiscovery.getBookmarkData(undefined);
    publicBackupData.discoverBookmarks = bookmarks;
    privateBackupData.discoverBookmarks = bookmarks;

    const { wallets } = await serviceAccount.getWallets();
    const walletAccountMap = wallets.reduce((summary, current) => {
      summary[current.id] = current;
      return summary;
    }, {} as Record<string, IDBWallet>);
    const { accounts: allAccounts } = await serviceAccount.getAllAccounts();
    for (const account of allAccounts) {
      const walletId = accountUtils.parseAccountId({
        accountId: account.id,
      }).walletId;
      const wallet = walletAccountMap[walletId];
      if (wallet && wallet.type !== WALLET_TYPE_HW) {
        if (wallet.type === WALLET_TYPE_IMPORTED) {
          const importedAccountUUID = getImportedAccountUUID(account);
          publicBackupData.importedAccounts[importedAccountUUID] = {
            name: account.name,
          };
          privateBackupData.importedAccounts[importedAccountUUID] = {
            ...account,
            version: IMPORTED_ACCOUNT_BACKUP_VERSION,
          };
        } else if (wallet.type === WALLET_TYPE_WATCHING) {
          const watchingAccountUUID = getWatchingAccountUUID(account);
          publicBackupData.watchingAccounts[watchingAccountUUID] = {
            name: account.name,
          };
          privateBackupData.watchingAccounts[watchingAccountUUID] = {
            ...account,
            version: WATCHING_ACCOUNT_BACKUP_VERSION,
          };
        } else if (wallet.type === WALLET_TYPE_HD) {
          const walletToBackup: IImportableHDWallet = privateBackupData.wallets[
            wallet.id
          ] ?? {
            id: walletId,
            name: wallet.name,
            type: wallet.type,
            accounts: [],
            accountIds: [],
            indexedAccountUUIDs: [],
            nextIds: wallet.nextIds,
            avatar: wallet.avatarInfo,
            version: HDWALLET_BACKUP_VERSION,
          };
          const HDAccountUUID = getHDAccountUUID(account);
          if (account.indexedAccountId) {
            const indexedAccount = await serviceAccount.getIndexedAccount({
              id: account.indexedAccountId,
            });
            account.name = indexedAccount.name;
            walletToBackup.indexedAccountUUIDs.push(account.indexedAccountId);
          }
          walletToBackup.accounts.push(account);
          walletToBackup.accountIds.push(HDAccountUUID);

          publicBackupData.HDWallets[wallet.id] = {
            name: walletToBackup.name,
            avatar: walletToBackup.avatar,
            accountUUIDs: walletToBackup.accountIds,
            indexedAccountUUIDs: Array.from(
              new Set(walletToBackup.indexedAccountUUIDs),
            ).map(() => generateUUID()),
          };
          privateBackupData.wallets[wallet.id] = walletToBackup;
        }
      }
    }

    return {
      privateData: password
        ? encrypt(
            password,
            Buffer.from(JSON.stringify(privateBackupData), 'utf8'),
          ).toString('base64')
        : '',
      publicData: publicBackupData,
      appVersion: version ?? '',
    };
  }

  @backgroundMethod()
  async backupNow(isManualBackup = true) {
    const cloudBackupValueList = await cloudBackupPersistAtom.get();
    const { isEnabled } = cloudBackupValueList;
    if (!isEnabled) {
      return;
    }

    let password = await this.backgroundApi.servicePassword.getCachedPassword();
    if (!password && isManualBackup) {
      password = (
        await this.backgroundApi.servicePassword.promptPasswordVerify()
      ).password;
    }
    if (!password) {
      return;
    }

    await cloudBackupPersistAtom.set({
      ...cloudBackupValueList,
      isEnabled,
      isInProgress: true,
    });
    const cloudData = {
      backupTime: Date.now(),
      deviceInfo: this.deviceInfo,
      ...(await this.getDataForBackup(password)),
    };
    const filename = generateUUID();
    try {
      if (!RNFS) return;
      const localTempFilePath = this.getTempFilePath(filename);
      if (!localTempFilePath) {
        throw new Error('Invalid local temp file path.');
      }
      await RNFS.writeFile(
        localTempFilePath,
        JSON.stringify(cloudData),
        'utf8',
      );
      await CloudFs.uploadToCloud(
        localTempFilePath,
        this.getBackupPath(filename),
      );
      const existMetaData = await this.getMetaDataFromCloud();
      existMetaData.push({
        filename,
        isManualBackup,
        deviceInfo: cloudData.deviceInfo,
        backupTime: cloudData.backupTime,
        appVersion: cloudData.appVersion,
        walletCount: Object.keys(cloudData.publicData.HDWallets).length,
        accountCount:
          Object.values(cloudData.publicData.HDWallets).reduce(
            (count, wallet) => count + wallet.indexedAccountUUIDs.length,
            0,
          ) +
          Object.keys(cloudData.publicData.importedAccounts).length +
          Object.keys(cloudData.publicData.watchingAccounts).length,
      });
      const newMetaData = JSON.stringify(existMetaData);
      JSON.parse(newMetaData);
      await RNFS.writeFile(localTempFilePath, newMetaData, 'utf8');
      await CloudFs.uploadToCloud(
        localTempFilePath,
        this.getBackupPath(CLOUD_METADATA_FILE_NAME),
      );
      await RNFS.unlink(localTempFilePath);
      this.metaDataCache = newMetaData;
      await this.getDataFromCloud.delete(CLOUD_METADATA_FILE_NAME);
    } catch (e) {
      await this.removeBackup(filename);
      console.error(e);
      throw e;
    } finally {
      await cloudBackupPersistAtom.set({
        ...cloudBackupValueList,
        isEnabled,
        isInProgress: false,
      });
    }
  }

  @backgroundMethod()
  async checkCloudBackupStatus() {
    await CloudFs.sync();
    const cloudBackupValueList = await cloudBackupPersistAtom.get();
    const { isEnabled } = cloudBackupValueList;
    if (isEnabled && !(await this.getCloudAvailable())) {
      await cloudBackupPersistAtom.set({
        ...cloudBackupValueList,
        isEnabled: false,
        isInProgress: false,
      });
      await this.logoutFromGoogleDrive(false);
      return false;
    }
    return true;
  }

  @backgroundMethod()
  getCloudAvailable() {
    return CloudFs.isAvailable();
  }

  async getMetaDataFromCloud() {
    if (!(await this.getCloudAvailable())) {
      return [];
    }
    const metaString = await this.getDataFromCloud(CLOUD_METADATA_FILE_NAME);
    if (metaString.length <= 0) {
      return [];
    }
    try {
      const metaData = JSON.parse(metaString) as IMetaDataObject[];
      return metaData;
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  @backgroundMethod()
  async getBackupDeviceList() {
    const metaData = await this.getMetaDataFromCloud();

    return Object.values(
      metaData.reduce((backupDeviceList, item) => {
        const deviceKey = `${item.deviceInfo.deviceName}_${item.deviceInfo.osName}`;
        if (
          !backupDeviceList[deviceKey] ||
          backupDeviceList[deviceKey].backupTime < item.backupTime
        ) {
          backupDeviceList[deviceKey] = item;
        }
        return backupDeviceList;
      }, {} as Record<string, IMetaDataObject>),
    ).sort((a, b) => b.backupTime - a.backupTime);
  }

  @backgroundMethod()
  async getBackupListFromDevice(deviceInfo: {
    deviceName: string;
    osName: string;
  }) {
    const metaData = await this.getMetaDataFromCloud();
    return metaData
      .filter(
        (item) =>
          item.deviceInfo.deviceName === deviceInfo.deviceName &&
          item.deviceInfo.osName === deviceInfo.osName,
      )
      .sort((a, b) => b.backupTime - a.backupTime);
  }

  // migrate the v4 data modal
  async maybeConvertBackupPublicData(_publicData: IPublicBackupData) {
    let publicData = _publicData;
    if (typeof publicData === 'string') {
      publicData = JSON.parse(publicData);
    }
    return publicData;
  }

  // migrate the v4 data modal
  async maybeConvertBackupPrivateData({
    privateData,
    remotePassword,
  }: {
    privateData: IPrivateBackupData;
    remotePassword: string;
  }) {
    Object.keys(privateData.credentials).forEach((key) => {
      const credential = privateData.credentials[key];
      try {
        const credentialRs = JSON.parse(credential) as {
          entropy: string;
          seed: string;
        };
        privateData.credentials[key] = encryptRevealableSeed({
          rs: {
            entropyWithLangPrefixed: credentialRs.entropy,
            seed: credentialRs.seed,
          },
          password: remotePassword,
        });
      } catch {
        //
      }
    });
    return privateData;
  }

  @backgroundMethod()
  async getBackupDiffListWithFilename(filename: string) {
    const backupData = JSON.parse(
      await this.getDataFromCloud(filename),
    ) as IBackupData;
    backupData.publicData = await this.maybeConvertBackupPublicData(
      backupData.publicData,
    );

    const remoteData = backupData.publicData;
    let diffCount = 0;
    const alreadyOnDevice: IPublicBackupData = {
      contacts: {},
      importedAccounts: {},
      watchingAccounts: {},
      HDWallets: {},
      discoverBookmarks: [],
    };

    const notOnDevice: IPublicBackupData = {
      contacts: {},
      importedAccounts: {},
      watchingAccounts: {},
      HDWallets: {},
      discoverBookmarks: [],
    };

    try {
      const localData = (await this.getDataForBackup('')).publicData;

      remoteData?.discoverBookmarks?.forEach((remoteBookMark) => {
        if (
          localData?.discoverBookmarks &&
          localData?.discoverBookmarks?.findIndex(
            (localBookMark) => localBookMark.url === remoteBookMark.url,
          ) > -1
        ) {
          alreadyOnDevice.discoverBookmarks?.push(remoteBookMark);
        } else {
          diffCount += 1;
          notOnDevice.discoverBookmarks?.push(remoteBookMark);
        }
      });

      for (const [contactUUID, contact] of Object.entries(
        remoteData.contacts,
      )) {
        if (typeof localData.contacts[contactUUID] !== 'undefined') {
          alreadyOnDevice.contacts[contactUUID] = contact;
        } else {
          diffCount += 1;
          notOnDevice.contacts[contactUUID] = contact;
        }
      }

      for (const [importedAccountUUID, importedAccount] of Object.entries(
        remoteData.importedAccounts,
      )) {
        if (
          typeof localData.importedAccounts[importedAccountUUID] !== 'undefined'
        ) {
          alreadyOnDevice.importedAccounts[importedAccountUUID] =
            importedAccount;
        } else {
          diffCount += 1;
          notOnDevice.importedAccounts[importedAccountUUID] = importedAccount;
        }
      }

      for (const [watchingAccountUUID, watchingAccount] of Object.entries(
        remoteData.watchingAccounts,
      )) {
        if (
          typeof localData.watchingAccounts[watchingAccountUUID] !== 'undefined'
        ) {
          alreadyOnDevice.watchingAccounts[watchingAccountUUID] =
            watchingAccount;
        } else {
          diffCount += 1;
          notOnDevice.watchingAccounts[watchingAccountUUID] = watchingAccount;
        }
      }

      const allLocalHDAccountUUIDs = ([] as Array<string>).concat(
        ...Object.values(localData.HDWallets).map(
          ({ accountUUIDs }) => accountUUIDs,
        ),
      );
      for (const [HDWalletId, HDWallet] of Object.entries(
        remoteData.HDWallets,
      )) {
        if (
          HDWallet.accountUUIDs.every((accountUUID) =>
            allLocalHDAccountUUIDs.includes(accountUUID),
          )
        ) {
          alreadyOnDevice.HDWallets[HDWalletId] = HDWallet;
        } else {
          diffCount += HDWallet.indexedAccountUUIDs.length;
          notOnDevice.HDWallets[HDWalletId] = HDWallet;
        }
      }
    } catch (e) {
      console.error('backup', e);
    }

    return { backupData, alreadyOnDevice, notOnDevice, diffCount };
  }

  @backgroundMethod()
  async restoreFromPrivateBackup({
    privateString,
    notOnDevice,
    localPassword,
    remotePassword,
  }: {
    privateString: string;
    notOnDevice: IPublicBackupData;
    localPassword: string;
    remotePassword: string;
  }) {
    const { serviceAccount, servicePassword, serviceAddressBook, simpleDb } =
      this.backgroundApi;
    await servicePassword.promptPasswordVerify({
      reason: EReasonForNeedPassword.CreateOrRemoveWallet,
    });

    let privateData: IPrivateBackupData;
    try {
      privateData = JSON.parse(
        decrypt(remotePassword, Buffer.from(privateString, 'base64')).toString(
          'utf8',
        ),
      );
    } catch {
      return ERestoreResult.WRONG_PASSWORD;
    }

    try {
      const restoreList = {
        importedAccounts: Object.keys(notOnDevice.importedAccounts),
        watchingAccounts: Object.keys(notOnDevice.watchingAccounts),
        HDWallets: Object.keys(notOnDevice.HDWallets),
      };

      privateData = await this.maybeConvertBackupPrivateData({
        privateData,
        remotePassword,
      });

      for (const id of restoreList.HDWallets) {
        const { version, name, accounts, avatar } = privateData.wallets[id];
        if (version !== HDWALLET_BACKUP_VERSION) {
          return;
        }

        const { rs: rsDecoded } =
          await serviceAccount.getCredentialDecryptFromCredential({
            password: remotePassword,
            credential: privateData.credentials[id],
          });
        const rsEncoded = encryptRevealableSeed({
          rs: rsDecoded,
          password: localPassword,
        });

        const { wallet } = await serviceAccount.createHDWalletWithRs({
          rs: rsEncoded,
          password: localPassword,
          avatarInfo: avatar,
        });
        await serviceAccount.restoreAccountsToWallet({
          walletId: wallet.id,
          accounts,
        });
        await serviceAccount.setWalletNameAndAvatar({
          walletId: wallet?.id,
          name,
        });
      }

      for (const id of restoreList.watchingAccounts) {
        const { version, ...account } = privateData.watchingAccounts[id];
        if (version !== WATCHING_ACCOUNT_BACKUP_VERSION) {
          return;
        }
        await serviceAccount.restoreAccountsToWallet({
          walletId: WALLET_TYPE_WATCHING,
          accounts: [account],
        });
      }

      for (const id of restoreList.importedAccounts) {
        const { version, ...account } = privateData.importedAccounts[id];
        if (version !== IMPORTED_ACCOUNT_BACKUP_VERSION) {
          return;
        }
        const importedCredential = encryptImportedCredential({
          credential: decryptImportedCredential({
            credential: privateData.credentials[account.id],
            password: remotePassword,
          }),
          password: localPassword,
        });

        await serviceAccount.restoreAccountsToWallet({
          walletId: WALLET_TYPE_IMPORTED,
          accounts: [account],
          importedCredential,
        });
      }

      for (const contactUUID of Object.keys(notOnDevice.contacts)) {
        const { name, address, networkId } = privateData.contacts[contactUUID];
        await serviceAddressBook.addItem({
          name,
          address,
          networkId,
        });
      }

      if (notOnDevice.discoverBookmarks) {
        const existBookmarks =
          (await simpleDb.browserBookmarks.getRawData()) ?? {
            data: [],
          };
        await simpleDb.browserBookmarks.setRawData({
          data: [...existBookmarks.data, ...notOnDevice.discoverBookmarks],
        });
      }
    } catch (e) {
      console.error('backup', e);
      return ERestoreResult.UNKNOWN_ERROR;
    }
  }

  private timer?: NodeJS.Timeout;

  @backgroundMethod()
  async requestAutoBackup() {
    try {
      const metaData = await this.getMetaDataFromCloud();
      const autoBackupList = metaData.filter(
        (current) => !current.isManualBackup,
      );
      if (autoBackupList.length <= 0) {
        await this.backupNow(false);
        return;
      }
      const latestBackup = autoBackupList.reduce(
        (reduceBackup, currentBackup) =>
          currentBackup.backupTime > reduceBackup.backupTime
            ? currentBackup
            : reduceBackup,
      );
      const autoBackupDuration = timerUtils.getTimeDurationMs({ hour: 1 });
      const delay = Math.max(
        0,
        Math.min(
          autoBackupDuration - (new Date().getTime() - latestBackup.backupTime),
          autoBackupDuration,
        ),
      );
      clearTimeout(this.timer);
      this.timer = setTimeout(async () => {
        clearTimeout(this.timer);
        void this.autoCreateAndRemoveBackup();
      }, delay);
    } catch (e) {
      console.error('backup auto task', e);
    }
  }

  async autoCreateAndRemoveBackup() {
    await this.backupNow(false);
    const metaData = await this.getMetaDataFromCloud();
    if (metaData.length <= 0) {
      return;
    }
    const willRemoveList = filterWillRemoveBackupList(metaData);
    for (const willRemoveBackup of willRemoveList) {
      await this.removeBackup(willRemoveBackup.filename);
    }
  }

  @backgroundMethod()
  async removeBackup(filename: string) {
    const existMetaData: IMetaDataObject[] = await this.getMetaDataFromCloud();
    const localTempFilePath = this.getTempFilePath(filename);
    if (!RNFS || !localTempFilePath) {
      return;
    }

    const newMetaData = JSON.stringify(
      existMetaData.filter((item) => item.filename !== filename),
    );

    await RNFS.writeFile(localTempFilePath, newMetaData, 'utf8');
    await CloudFs.uploadToCloud(
      localTempFilePath,
      this.getBackupPath(CLOUD_METADATA_FILE_NAME),
    );
    await RNFS.unlink(localTempFilePath);

    const removed = await CloudFs.deleteFile(this.getBackupPath(filename));
    if (removed) {
      this.metaDataCache = newMetaData;
      await this.getDataFromCloud.delete(CLOUD_METADATA_FILE_NAME);
    }
  }

  @backgroundMethod()
  async loginIfNeeded(showSignInDialog: boolean) {
    return CloudFs.loginIfNeeded(showSignInDialog);
  }

  @backgroundMethod()
  async logoutFromGoogleDrive(revokeAccess: boolean) {
    return CloudFs.logoutFromGoogleDrive(revokeAccess);
  }

  private metaDataCache = '';

  private getDataFromCloud = memoizee(
    async (filename: string) => {
      try {
        const content = await CloudFs.downloadFromCloud(
          platformEnv.isNativeIOS ? filename : this.getBackupPath(filename),
        );
        if (
          filename === CLOUD_METADATA_FILE_NAME &&
          (content?.length ?? 0) <= 0 &&
          this.metaDataCache.length > 0
        ) {
          return this.metaDataCache;
        }
        return content;
      } catch (e) {
        if (
          filename === CLOUD_METADATA_FILE_NAME &&
          this.metaDataCache.length > 0
        ) {
          return this.metaDataCache;
        }
        return '[]';
      }
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 60 }),
      max: 50,
    },
  );
}

export default ServiceCloudBackup;
