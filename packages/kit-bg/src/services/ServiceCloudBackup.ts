import { deviceName, osName } from 'expo-device';
import { debounce } from 'lodash';
import uuid from 'react-native-uuid';

import { shortenAddress } from '@onekeyhq/components/src/utils';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import {
  decrypt,
  encrypt,
} from '@onekeyhq/engine/src/secret/encryptors/aes256';
import {
  incrBackupRequests,
  setDisabled,
  setEnabled,
  setInProgress,
  setIsAvailable,
  setNotInProgress,
} from '@onekeyhq/kit/src/store/reducers/cloudBackup';
import { create } from '@onekeyhq/kit/src/store/reducers/contacts';
import type { Contact } from '@onekeyhq/kit/src/store/reducers/contacts';
import { release } from '@onekeyhq/kit/src/store/reducers/data';
import { addBookmark } from '@onekeyhq/kit/src/store/reducers/discover';
import { setEnableLocalAuthentication } from '@onekeyhq/kit/src/store/reducers/settings';
import { unlock } from '@onekeyhq/kit/src/store/reducers/status';
import {
  hasHardwareSupported,
  savePassword,
} from '@onekeyhq/kit/src/utils/localAuthentication';
import { parseCloudData } from '@onekeyhq/kit/src/views/Onboarding/screens/Migration/util';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import * as CloudFs from '@onekeyhq/shared/src/cloudfs';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { RestoreResult } from '@onekeyhq/shared/src/services/ServiceCloudBackup/ServiceCloudBackup.enums';
import type {
  BackupedContacts,
  IBackupItemSummary,
  ISimpleDBBackUp,
  PublicBackupData,
} from '@onekeyhq/shared/src/services/ServiceCloudBackup/ServiceCloudBackup.types';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import ServiceBase from './ServiceBase';

// uuid.v5('onekey', '00000000-0000-0000-0000-000000000000')
// const ONEKEY_NAMESPACE = '30303338-6435-5664-a334-323538396638';
// uuid.v5('Contact', ONEKEY_NAMESPACE)
const CONTACT_NAMESPACE = '63363334-3563-5463-a336-666666353665';
// uuid.v5('Backup device', ONEKEY_NAMESPACE)
const BACKUP_DEVICE_NAMESPACE = '38366232-6538-5532-b461-393837633133';

function getContactUUID({
  address,
  networkId,
}: {
  address: string;
  networkId: string;
}): string {
  return uuid.v5(`${networkId},${address}`, CONTACT_NAMESPACE) as string;
}

@backgroundClass()
class ServiceCloudBackup extends ServiceBase {
  private backupUUID = '';

  private deviceInfo = {
    osName: osName ?? 'unknown',
    deviceName: deviceName ?? 'unknown',
  };

  private getBackupFilename(backupUUID: string) {
    return `${backupUUID}.backup`;
  }

  private getBackupPath(backupUUID: string) {
    return `onekey/${this.getBackupFilename(backupUUID)}`;
  }

  private getTempFilePath(backupUUID: string) {
    if (!RNFS) return;
    return `${RNFS.DocumentDirectoryPath ?? ''}/${this.getBackupFilename(
      backupUUID,
    )}`;
  }

  private async ensureUUID() {
    this.backupUUID =
      this.backupUUID || (await this.backgroundApi.engine.getBackupUUID());
    return this.backupUUID;
  }

  @backgroundMethod()
  async getDataForBackup(password: string) {
    const publicBackupData: PublicBackupData = {
      contacts: {},
      importedAccounts: {},
      watchingAccounts: {},
      HDWallets: {},
      simpleDb: { market: { favorites: [] }, utxoAccounts: { utxos: [] } },
      discoverBookmarks: [],
      // browserHistories: [],
    };
    const backupedContacts: BackupedContacts = {};
    const { version } = this.backgroundApi.appSelector((s) => s.settings);

    const { contacts }: { contacts: Record<string, Contact> } =
      this.backgroundApi.appSelector((s) => s.contacts);
    Object.values(contacts).forEach((contact) => {
      const contactUUID = getContactUUID(contact);
      publicBackupData.contacts[contactUUID] = {
        name: contact.name,
        address: shortenAddress(contact.address),
      };
      backupedContacts[contactUUID] = {
        name: contact.name,
        address: contact.address,
        networkId: contact.networkId,
      };
    });

    const { utxoAccounts, market } = simpleDb;
    const utxoAccountsRawData = await utxoAccounts.getRawData();
    const marketRawData = await market.getRawData();
    const utxos = utxoAccountsRawData?.utxos ?? [];
    const favorites = marketRawData?.favorites ?? [];

    const backupedSimpleDB = {
      utxoAccounts: { utxos },
      market: { favorites },
    };
    publicBackupData.simpleDb = backupedSimpleDB;

    const { bookmarks } = this.backgroundApi.appSelector((s) => s.discover);
    publicBackupData.discoverBookmarks = bookmarks;
    // publicBackupData.browserHistories = userBrowserHistories;

    const backupObject = await this.backgroundApi.engine.dumpDataForBackup(
      password,
    );

    for (const [importedAccountUUID, { name, id, address }] of Object.entries(
      backupObject.importedAccounts,
    )) {
      const longAddress = id.split('--')[2] ?? address;
      publicBackupData.importedAccounts[importedAccountUUID] = {
        name,
        address: shortenAddress(longAddress),
      };
    }

    for (const [watchingAccountUUID, { name, id, address }] of Object.entries(
      backupObject.watchingAccounts,
    )) {
      const longAddress = id.split('--')[2] ?? address;
      publicBackupData.watchingAccounts[watchingAccountUUID] = {
        name,
        address: shortenAddress(longAddress),
      };
    }

    for (const [
      walletId,
      { name, avatar, accountIds: accountUUIDs },
    ] of Object.entries(backupObject.wallets)) {
      publicBackupData.HDWallets[walletId] = { name, avatar, accountUUIDs };
    }

    return {
      private: '{}',
      public: '{}',
      privateData: password
        ? encrypt(
            password,
            Buffer.from(
              JSON.stringify({
                ...backupObject,
                contacts: backupedContacts,
                discoverBookmarks: bookmarks,
                simpleDb: backupedSimpleDB,
                // browserHistories: userBrowserHistories,
              }),
              'utf8',
            ),
          ).toString('base64')
        : '',
      publicData: JSON.stringify(publicBackupData),
      appVersion: version,
    };
  }

  @backgroundMethod()
  async backupNow() {
    const { appSelector, dispatch, servicePassword } = this.backgroundApi;

    const { enabled, backupRequests, isAvailable } = appSelector(
      (s) => s.cloudBackup,
    );
    const availableStatus = await CloudFs.isAvailable();
    if (availableStatus !== isAvailable) {
      dispatch(setIsAvailable(availableStatus));
    }
    if (!enabled || backupRequests === 0 || !availableStatus) {
      return;
    }

    const password = await servicePassword.getPassword();
    if (!password) {
      return;
    }
    dispatch(setInProgress());

    const cloudData = JSON.stringify({
      uuid: await this.ensureUUID(),
      backupTime: Date.now(),
      deviceInfo: this.deviceInfo,
      ...(await this.getDataForBackup(password)),
    });
    const actions: any[] = [];
    try {
      await this.saveDataToCloud(cloudData);
    } catch (e) {
      debugLogger.cloudBackup.error((e as Error).message);
      actions.push(incrBackupRequests());
    }
    actions.push(setNotInProgress());
    dispatch(...actions);
  }

  private onBackupRequired = debounce(async () => this.backupNow(), 30000, {
    leading: false,
    trailing: true,
  });

  @backgroundMethod()
  initCloudBackup() {
    appEventBus.on(AppEventBusNames.BackupRequired, this.onBackupRequired);
    appEventBus.emit(AppEventBusNames.BackupRequired);
  }

  @backgroundMethod()
  async getBackupStatus() {
    const { appSelector, dispatch } = this.backgroundApi;
    const { isAvailable } = appSelector((s) => s.cloudBackup);
    if (!(await CloudFs.isAvailable())) {
      if (isAvailable) {
        dispatch(setIsAvailable(false));
      }
      return { hasPreviousBackups: false };
    }
    if (!isAvailable) {
      dispatch(setIsAvailable(true));
    }
    await this.syncCloud();
    const backupUUID = await this.ensureUUID();
    const filenames = await this.listBackups();
    return {
      hasPreviousBackups:
        filenames.filter((name) => name !== backupUUID).length > 0,
    };
  }

  @backgroundMethod()
  async getPreviousBackups() {
    await this.syncCloud();
    const currentUUID = await this.ensureUUID();
    const backupUUIDs = await this.listBackups();
    const backupSummaries: Record<string, Array<IBackupItemSummary>> = {};
    for (const backupUUID of backupUUIDs.filter(
      (tmpUUID) => tmpUUID !== currentUUID,
    )) {
      try {
        const cloudData = parseCloudData(
          JSON.parse(await this.getDataFromCloud(backupUUID)),
        );
        const {
          backupTime,
          deviceInfo,
          public: publicBackupData,
        }: {
          backupTime: number;
          deviceInfo: { osName: string; deviceName: string };
          public: string;
        } = cloudData;
        const {
          HDWallets = {},
          importedAccounts = {},
          watchingAccounts = {},
        } = JSON.parse(publicBackupData) as PublicBackupData;
        const backupDeviceId = uuid.v5(
          `${deviceInfo.osName},${deviceInfo.deviceName}`,
          BACKUP_DEVICE_NAMESPACE,
        ) as string;
        if (typeof backupSummaries[backupDeviceId] === 'undefined') {
          backupSummaries[backupDeviceId] = [];
        }
        const numOfAccounts =
          Object.values(HDWallets).reduce(
            (count, wallet) => count + wallet.accountUUIDs.length,
            0,
          ) +
          Object.keys(importedAccounts).length +
          Object.keys(watchingAccounts).length;

        backupSummaries[backupDeviceId].push({
          backupUUID,
          backupTime,
          deviceInfo,
          numOfHDWallets: Object.keys(HDWallets).length,
          numOfAccounts,
        });
      } catch (e) {
        debugLogger.cloudBackup.error((e as Error).message);
      }
    }
    return Object.values(backupSummaries)
      .map((group) => group.sort((a, b) => b.backupTime - a.backupTime))
      .sort((a, b) => b[0].backupTime - a[0].backupTime);
  }

  @backgroundMethod()
  async getBackupDetailsWithRemoteData(remoteData: PublicBackupData) {
    const alreadyOnDevice: PublicBackupData = {
      contacts: {},
      importedAccounts: {},
      watchingAccounts: {},
      HDWallets: {},
      simpleDb: {} as ISimpleDBBackUp,
      discoverBookmarks: [],
      // browserHistories: [],
    };

    const notOnDevice: PublicBackupData = {
      contacts: {},
      importedAccounts: {},
      watchingAccounts: {},
      HDWallets: {},
      simpleDb: {} as ISimpleDBBackUp,
      discoverBookmarks: [],
      // browserHistories: [],
    };
    alreadyOnDevice.simpleDb = {
      utxoAccounts: { utxos: [] },
      market: { favorites: [] },
    };
    notOnDevice.simpleDb = {
      utxoAccounts: { utxos: [] },
      market: { favorites: [] },
    };

    try {
      const localData = JSON.parse(
        (await this.getDataForBackup('')).publicData,
      ) as PublicBackupData;

      remoteData?.discoverBookmarks?.forEach((remoteBookMark) => {
        if (
          localData?.discoverBookmarks &&
          localData?.discoverBookmarks?.findIndex(
            (localBookMark) => localBookMark.id === remoteBookMark.id,
          ) > -1
        ) {
          alreadyOnDevice.discoverBookmarks?.push(remoteBookMark);
        } else {
          notOnDevice.discoverBookmarks?.push(remoteBookMark);
        }
      });

      // remoteData?.browserHistories?.forEach((remoteHis) => {
      //   if (
      //     localData?.browserHistories &&
      //     localData?.browserHistories?.findIndex(
      //       (localHis) => localHis.url === remoteHis.url,
      //     ) > -1
      //   ) {
      //     alreadyOnDevice.browserHistories?.push(remoteHis);
      //   } else {
      //     notOnDevice.browserHistories?.push(remoteHis);
      //   }
      // });

      for (const [contactUUID, contact] of Object.entries(
        remoteData.contacts,
      )) {
        if (typeof localData.contacts[contactUUID] !== 'undefined') {
          alreadyOnDevice.contacts[contactUUID] = contact;
        } else {
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
          notOnDevice.HDWallets[HDWalletId] = HDWallet;
        }
      }

      // simpleDb
      notOnDevice.simpleDb.utxoAccounts.utxos = (
        remoteData.simpleDb?.utxoAccounts?.utxos ?? []
      ).filter(
        (utxo) =>
          (localData.simpleDb?.utxoAccounts?.utxos ?? []).findIndex(
            (localUtxo) => localUtxo.id === utxo.id,
          ) < 0,
      );

      alreadyOnDevice.simpleDb.utxoAccounts.utxos = (
        remoteData.simpleDb?.utxoAccounts?.utxos ?? []
      ).filter(
        (utxo) =>
          (localData.simpleDb?.utxoAccounts?.utxos ?? []).findIndex(
            (localUtxo) => localUtxo.id === utxo.id,
          ) > -1,
      );

      remoteData?.simpleDb?.market?.favorites?.forEach((remoteId) => {
        if (
          localData.simpleDb?.market.favorites &&
          localData.simpleDb?.market.favorites.includes(remoteId)
        ) {
          alreadyOnDevice.simpleDb?.market.favorites.push(remoteId);
        } else {
          notOnDevice.simpleDb?.market.favorites.push(remoteId);
        }
      });
    } catch (e) {
      debugLogger.cloudBackup.error((e as Error).message);
    }

    return { alreadyOnDevice, notOnDevice };
  }

  @backgroundMethod()
  async getBackupDetails(backupUUID: string) {
    const { public: publicBackupData, appVersion } = parseCloudData(
      JSON.parse(await this.getDataFromCloud(backupUUID)),
    );
    const remoteData = JSON.parse(publicBackupData) as PublicBackupData;
    return {
      backupDetails: await this.getBackupDetailsWithRemoteData(remoteData),
      appVersion,
    };
  }

  @backgroundMethod()
  async restoreFromPrivateBackup({
    privateBackupData,
    notOnDevice,
    localPassword,
    remotePassword,
  }: {
    privateBackupData: any;
    notOnDevice: PublicBackupData;
    localPassword: string;
    remotePassword?: string;
  }): Promise<RestoreResult> {
    const {
      dispatch,
      engine,
      appSelector,
      serviceAccount,
      serviceApp,
      servicePassword,
    } = this.backgroundApi;
    const { isPasswordSet } = appSelector((s) => s.data);
    const activeAccountId = appSelector((s) => s.general.activeAccountId);

    let data = '';
    try {
      data = decrypt(
        remotePassword ?? localPassword,
        Buffer.from(privateBackupData, 'base64'),
      ).toString('utf8');
    } catch {
      return RestoreResult.WRONG_PASSWORD;
    }

    try {
      await engine.restoreDataFromBackup({
        data,
        localPassword,
        remotePassword: remotePassword ?? localPassword,
        uuidsToRestore: {
          importedAccounts: Object.keys(notOnDevice.importedAccounts),
          watchingAccounts: Object.keys(notOnDevice.watchingAccounts),
          HDWallets: Object.keys(notOnDevice.HDWallets),
        },
      });
      const {
        contacts: backupedContacts,
      }: {
        contacts: BackupedContacts;
      } = JSON.parse(data);

      if (notOnDevice.discoverBookmarks) {
        for (const bookmark of notOnDevice.discoverBookmarks) {
          dispatch(addBookmark(bookmark));
        }
      }

      if (notOnDevice.simpleDb?.market.favorites) {
        const tokenDetails =
          await this.backgroundApi.serviceMarket.getTokensDetail(
            notOnDevice.simpleDb?.market.favorites,
          );
        const favoriteInfos = notOnDevice.simpleDb.market.favorites.map(
          (id) => {
            const token = tokenDetails.find((t) => t.coingeckoId === id);
            return {
              coingeckoId: id,
              symbol: token?.symbol,
            };
          },
        );
        await this.backgroundApi.serviceMarket.saveMarketFavoriteTokens(
          favoriteInfos,
        );
      }

      for (const contactUUID of Object.keys(notOnDevice.contacts)) {
        const { name, address, networkId } = backupedContacts[contactUUID];
        if (name && address && networkId) {
          dispatch(
            create({
              name,
              address,
              networkId,
              badge: networkId.split('--')[0],
            }),
          );
        } else {
          debugLogger.cloudBackup.error(
            `Contact ${contactUUID} not found in backup data.`,
          );
        }
      }
    } catch (e) {
      debugLogger.cloudBackup.error((e as Error).message);
      return RestoreResult.UNKNOWN_ERROR;
    }
    if (!activeAccountId) {
      try {
        await serviceAccount.autoChangeWallet();
      } catch {
        debugLogger.cloudBackup.error('autoChangeWallet error');
      }
    } else {
      await serviceAccount.initWallets();
    }
    if (!isPasswordSet) {
      await serviceApp.initPassword();
      // Unlock the app
      dispatch(unlock(), release());
      // Save password to servicePassword by default
      await servicePassword.savePassword(localPassword);
      // Save password to use local authentication
      if (await hasHardwareSupported()) {
        dispatch(setEnableLocalAuthentication(true));
        await savePassword(localPassword);
      }
    }

    return RestoreResult.SUCCESS;
  }

  @backgroundMethod()
  async restoreFromBackup({
    backupUUID,
    notOnDevice,
    localPassword,
    remotePassword,
  }: {
    backupUUID: string;
    notOnDevice: PublicBackupData;
    localPassword: string;
    remotePassword?: string;
  }): Promise<RestoreResult> {
    const { private: privateBackupData } = parseCloudData(
      JSON.parse(await this.getDataFromCloud(backupUUID)),
    );
    return this.restoreFromPrivateBackup({
      privateBackupData,
      notOnDevice,
      localPassword,
      remotePassword,
    });
  }

  @backgroundMethod()
  enableService() {
    const { dispatch } = this.backgroundApi;
    dispatch(setEnabled(), incrBackupRequests());
    this.backupNow();
  }

  @backgroundMethod()
  async disableService() {
    const { dispatch } = this.backgroundApi;
    await this.removeBackup(await this.ensureUUID());
    dispatch(setDisabled());
  }

  @backgroundMethod()
  requestBackup() {
    const { appSelector, dispatch } = this.backgroundApi;
    const { enabled } = appSelector((s) => s.cloudBackup);
    if (enabled) {
      dispatch(incrBackupRequests());
      appEventBus.emit(AppEventBusNames.BackupRequired);
    }
  }

  @backgroundMethod()
  async removeBackup(backupUUID: string) {
    try {
      const removed = await CloudFs.deleteFile(this.getBackupPath(backupUUID));
      if (removed) {
        this.listBackups.clear();
      }
    } catch (e) {
      debugLogger.cloudBackup.error((e as Error).message);
    }
  }

  @backgroundMethod()
  async loginIfNeeded(showSignInDialog: boolean) {
    return CloudFs.loginIfNeeded(showSignInDialog);
  }

  private syncCloud = memoizee(async () => CloudFs.sync(), {
    promise: true,
    maxAge: 1000 * 30,
  });

  private listBackups = memoizee(
    async () =>
      (await CloudFs.listFiles('onekey/')).map((filename) =>
        filename.replace(/^\./, '').replace(/\.backup.*$/, ''),
      ),
    {
      promise: true,
      maxAge: 1000 * 30,
    },
  );

  private getDataFromCloud = memoizee(
    (backupUUID: string) =>
      CloudFs.downloadFromCloud(
        platformEnv.isNativeIOS
          ? this.getBackupFilename(backupUUID)
          : this.getBackupPath(backupUUID),
      ),
    {
      promise: true,
      maxAge: 1000 * 30,
      max: 50,
    },
  );

  private async saveDataToCloud(data: string) {
    if (!RNFS) return;
    const backupUUID = await this.ensureUUID();
    if (!backupUUID) {
      throw Error('Invalid backup uuid.');
    }
    const localTempFilePath = this.getTempFilePath(backupUUID);
    if (!localTempFilePath) {
      throw new Error('Invalid local temp file path.');
    }
    await RNFS.writeFile(localTempFilePath, data, 'utf8');
    debugLogger.cloudBackup.debug(`Backup file ${localTempFilePath} written.`);
    await CloudFs.uploadToCloud(
      localTempFilePath,
      this.getBackupPath(backupUUID),
    );
    await RNFS.unlink(localTempFilePath);
    debugLogger.cloudBackup.debug(`Backup file ${localTempFilePath} deleted.`);
  }
}

export default ServiceCloudBackup;
