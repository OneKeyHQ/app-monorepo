import {
  decrypt,
  encrypt,
} from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import * as FileSystem from 'expo-file-system';
import { debounce } from 'lodash';
import memoizee from 'memoizee';
import RNCloudFs from 'react-native-cloud-fs';
import uuid from 'react-native-uuid';

import { shortenAddress } from '@onekeyhq/components/src/utils';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
import { Avatar } from '../../utils/emojiUtils';
import {
  hasHardwareSupported,
  savePassword,
} from '../../utils/localAuthentication';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase, { IServiceBaseProps } from './ServiceBase';

import type { Contact } from '../../store/reducers/contacts';

export type PublicBackupData = {
  contacts: Record<string, { name: string; address: string }>;
  importedAccounts: Record<string, { name: string; address: string }>;
  watchingAccounts: Record<string, { name: string; address: string }>;
  HDWallets: Record<
    string,
    { name: string; avatar?: Avatar; accountUUIDs: Array<string> }
  >;
};

type BackupedContacts = Record<
  string,
  { name: string; address: string; networkId: string }
>;

// uuid.v5('onekey', '00000000-0000-0000-0000-000000000000')
// const ONEKEY_NAMESPACE = '30303338-6435-5664-a334-323538396638';
// uuid.v5('Contact', ONEKEY_NAMESPACE)
const CONTACT_NAMESPACE = '63363334-3563-5463-a336-666666353665';

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

  private async isAvailable(): Promise<boolean> {
    return !!platformEnv.isNativeIOS && RNCloudFs.isAvailable();
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
      const availableStatus = await this.isAvailable();
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
        backupTime: Date.now(),
        uuid: await this.ensureUUID(),
        ...(await this.getDataForBackup(password)),
      });
      dispatch(setInProgress());
      try {
        await this.saveDataToCloud(cloudData);
      } catch (e) {
        debugLogger.cloudBackup.error(e);
        dispatch(incrBackupRequests());
      }
      dispatch(setNotInProgress());
    },
    5000,
    { leading: false, trailing: true },
  );

  constructor(props: IServiceBaseProps) {
    super(props);
    appEventBus.on(AppEventBusNames.BackupRequired, this.onBackupRequired);
    appEventBus.emit(AppEventBusNames.BackupRequired);
  }

  @backgroundMethod()
  async getBackupStatus() {
    if (!(await this.isAvailable())) {
      return { hasPreviousBackups: false };
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
    const backupSummaries = [];
    for (const backupUUID of backupUUIDs.filter(
      (tmpUUID) => tmpUUID !== currentUUID,
    )) {
      try {
        const { backupTime, public: publicBackupData } = JSON.parse(
          await this.getDataFromCloud(backupUUID),
        );
        const {
          contacts = {},
          HDWallets = {},
          importedAccounts = {},
          watchingAccounts = {},
        } = JSON.parse(publicBackupData) as PublicBackupData;
        backupSummaries.push({
          backupUUID,
          backupTime,
          numOfHDWallets: Object.keys(HDWallets).length,
          numOfImportedAccounts: Object.keys(importedAccounts).length,
          numOfWatchingAccounts: Object.keys(watchingAccounts).length,
          numOfContacts: Object.keys(contacts).length,
        });
      } catch (e) {
        debugLogger.cloudBackup.error(e);
      }
    }
    return backupSummaries.sort((a, b) => b.backupTime - a.backupTime);
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
      debugLogger.cloudBackup.error(e);
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
  }) {
    const {
      dispatch,
      engine,
      appSelector,
      serviceAccount,
      serviceApp,
      servicePassword,
    } = this.backgroundApi;
    const { isPasswordSet } = appSelector((s) => s.data);
    const activeWalletId = appSelector((s) => s.general.activeWalletId);
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
      throw new Error('Invalid password');
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
      debugLogger.cloudBackup.error(e);
      throw e;
    }
    if (!activeWalletId) {
      await serviceAccount.autoChangeWallet();
    } else {
      await serviceAccount.initWallets();
    }
    if (!isPasswordSet) {
      await serviceApp.initPassword();
      // Unlock the app
      dispatch(unlock());
      dispatch(release());
      // Save password to servicePassword by default
      await servicePassword.savePassword(localPassword);
      // Save password to use local authentication
      if (await hasHardwareSupported()) {
        dispatch(setEnableLocalAuthentication(true));
        await savePassword(localPassword);
      }
    }
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
    if (platformEnv.isNativeIOS) {
      const {
        files: [file],
      }: { files: Array<{ isFile: boolean }> } = await RNCloudFs.listFiles({
        scope: 'hidden',
        targetPath: this.getBackupPath(backupUUID),
      });
      if (file && file.isFile) {
        await RNCloudFs.deleteFromCloud(file);
        this.listBackups.clear();
      }
    }
  }

  private syncCloud = memoizee(
    async () => {
      if (platformEnv.isNativeIOS) {
        return RNCloudFs.syncCloud();
      }
      return true;
    },
    {
      promise: true,
      maxAge: 1000 * 30,
    },
  );

  private listBackups = memoizee(
    async () => {
      if (platformEnv.isNativeIOS) {
        const { files }: { files: Array<{ isFile: boolean; name: string }> } =
          await RNCloudFs.listFiles({
            scope: 'hidden',
            targetPath: 'onekey/',
          });
        return files
          .filter((file) => file.isFile)
          .map(({ name }) =>
            name.replace(/^\./, '').replace(/\.backup.*$/, ''),
          );
      }
      return [];
    },
    {
      promise: true,
      maxAge: 1000 * 30,
    },
  );

  private getDataFromCloud = memoizee(
    (backupUUID: string) =>
      RNCloudFs.getIcloudDocument(this.getBackupFilename(backupUUID)),
    {
      promise: true,
      maxAge: 1000 * 30,
      max: 50,
    },
  );

  private async saveDataToCloud(data: string) {
    if (platformEnv.isNativeIOS) {
      const backupUUID = await this.ensureUUID();
      if (!backupUUID) {
        throw Error('Invalid backup uuid.');
      }
      const localTempFilePath = this.getTempFilePath(backupUUID);
      await FileSystem.writeAsStringAsync(localTempFilePath, data);
      debugLogger.cloudBackup.debug(
        `Backup file ${localTempFilePath} written.`,
      );
      await RNCloudFs.copyToCloud({
        mimeType: null,
        scope: 'hidden',
        sourcePath: { path: localTempFilePath },
        targetPath: this.getBackupPath(backupUUID),
      });
      await FileSystem.deleteAsync(localTempFilePath, { idempotent: true });
      debugLogger.cloudBackup.debug(
        `Backup file ${localTempFilePath} deleted.`,
      );
    }
  }
}

export default ServiceCloudBackup;
