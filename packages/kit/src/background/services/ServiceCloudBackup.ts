import {
  decrypt,
  encrypt,
} from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system';
import { debounce } from 'lodash';
import memoizee from 'memoizee';
import uuid from 'react-native-uuid';

import { shortenAddress } from '@onekeyhq/components/src/utils';
import * as CloudFs from '@onekeyhq/shared/src/cloudfs';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import {
  incrBackupRequests,
  setDisabled,
  setEnabled,
  setInProgress,
  setIsAvailable,
  setNotInProgress,
} from '../../store/reducers/cloudBackup';
import { create } from '../../store/reducers/contacts';
import { release } from '../../store/reducers/data';
import { setEnableLocalAuthentication } from '../../store/reducers/settings';
import { unlock } from '../../store/reducers/status';
import {
  hasHardwareSupported,
  savePassword,
} from '../../utils/localAuthentication';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';
import {
  BackupedContacts,
  IBackupItemSummary,
  PublicBackupData,
  RestoreResult,
} from './ServiceCloudBackup.types';

import type { Contact } from '../../store/reducers/contacts';

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
    osName: Device.osName ?? 'unknown',
    deviceName: Device.deviceName ?? 'unknown',
  };

  private getBackupFilename(backupUUID: string) {
    return `${backupUUID}.backup`;
  }

  private getBackupPath(backupUUID: string) {
    return `onekey/${this.getBackupFilename(backupUUID)}`;
  }

  private getTempFilePath(backupUUID: string) {
    return `${FileSystem.cacheDirectory ?? ''}${this.getBackupFilename(
      backupUUID,
    )}`;
  }

  private async ensureUUID() {
    this.backupUUID =
      this.backupUUID || (await this.backgroundApi.engine.getBackupUUID());
    return this.backupUUID;
  }

  private async getDataForBackup(password: string) {
    const publicBackupData: PublicBackupData = {
      contacts: {},
      importedAccounts: {},
      watchingAccounts: {},
      HDWallets: {},
    };
    const backupedContacts: BackupedContacts = {};

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

    const backupObject = await this.backgroundApi.engine.dumpDataForBackup(
      password,
    );
    for (const [importedAccountUUID, { name, address }] of Object.entries(
      backupObject.importedAccounts,
    )) {
      publicBackupData.importedAccounts[importedAccountUUID] = {
        name,
        address: shortenAddress(address),
      };
    }

    for (const [watchingAccountUUID, { name, address }] of Object.entries(
      backupObject.watchingAccounts,
    )) {
      publicBackupData.watchingAccounts[watchingAccountUUID] = {
        name,
        address: shortenAddress(address),
      };
    }

    for (const [
      walletId,
      { name, avatar, accountIds: accountUUIDs },
    ] of Object.entries(backupObject.wallets)) {
      publicBackupData.HDWallets[walletId] = { name, avatar, accountUUIDs };
    }

    return {
      private: password
        ? encrypt(
            password,
            Buffer.from(
              JSON.stringify({ ...backupObject, contacts: backupedContacts }),
              'utf8',
            ),
          ).toString('base64')
        : '',
      public: JSON.stringify(publicBackupData),
    };
  }

  private onBackupRequired = debounce(
    async () => {
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

      const cloudData = JSON.stringify({
        uuid: await this.ensureUUID(),
        backupTime: Date.now(),
        deviceInfo: this.deviceInfo,
        ...(await this.getDataForBackup(password)),
      });
      dispatch(setInProgress());
      try {
        await this.saveDataToCloud(cloudData);
      } catch (e) {
        debugLogger.cloudBackup.error((e as Error).message);
        dispatch(incrBackupRequests());
      }
      dispatch(setNotInProgress());
    },
    5000,
    { leading: false, trailing: true },
  );

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
        const {
          backupTime,
          deviceInfo,
          public: publicBackupData,
        }: {
          backupTime: number;
          deviceInfo: { osName: string; deviceName: string };
          public: string;
        } = JSON.parse(await this.getDataFromCloud(backupUUID));
        const {
          contacts = {},
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
        backupSummaries[backupDeviceId].push({
          backupUUID,
          backupTime,
          deviceInfo,
          numOfHDWallets: Object.keys(HDWallets).length,
          numOfImportedAccounts: Object.keys(importedAccounts).length,
          numOfWatchingAccounts: Object.keys(watchingAccounts).length,
          numOfContacts: Object.keys(contacts).length,
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
  async getBackupDetails(backupUUID: string) {
    const alreadyOnDevice: PublicBackupData = {
      contacts: {},
      importedAccounts: {},
      watchingAccounts: {},
      HDWallets: {},
    };
    const notOnDevice: PublicBackupData = {
      contacts: {},
      importedAccounts: {},
      watchingAccounts: {},
      HDWallets: {},
    };

    try {
      const { public: publicBackupData } = JSON.parse(
        await this.getDataFromCloud(backupUUID),
      );
      const remoteData = JSON.parse(publicBackupData) as PublicBackupData;
      const localData = JSON.parse(
        (await this.getDataForBackup('')).public,
      ) as PublicBackupData;

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
    } catch (e) {
      debugLogger.cloudBackup.error((e as Error).message);
    }

    return { alreadyOnDevice, notOnDevice };
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
    const { private: privateBackupData } = JSON.parse(
      await this.getDataFromCloud(backupUUID),
    );

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
      const { contacts: backupedContacts }: { contacts: BackupedContacts } =
        JSON.parse(data);
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
      await serviceAccount.autoChangeWallet();
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
  enableService() {
    const { dispatch } = this.backgroundApi;
    dispatch(setEnabled());
    this.requestBackup();
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
      CloudFs.downloadFromCloud(this.getBackupFilename(backupUUID)),
    {
      promise: true,
      maxAge: 1000 * 30,
      max: 50,
    },
  );

  private async saveDataToCloud(data: string) {
    const backupUUID = await this.ensureUUID();
    if (!backupUUID) {
      throw Error('Invalid backup uuid.');
    }
    const localTempFilePath = this.getTempFilePath(backupUUID);
    await FileSystem.writeAsStringAsync(localTempFilePath, data);
    debugLogger.cloudBackup.debug(`Backup file ${localTempFilePath} written.`);
    await CloudFs.uploadToCloud(
      localTempFilePath,
      this.getBackupPath(backupUUID),
    );
    await FileSystem.deleteAsync(localTempFilePath, { idempotent: true });
    debugLogger.cloudBackup.debug(`Backup file ${localTempFilePath} deleted.`);
  }
}

export default ServiceCloudBackup;
