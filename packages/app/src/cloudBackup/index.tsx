import * as FileSystem from 'expo-file-system';
import { sortBy } from 'lodash';
import { NativeModules, Platform } from 'react-native';

import { FilesType } from './type';

const { RNCloudFs } = NativeModules;

export const USERDATA_FILE = 'UserData.json';
const REMOTE_BACKUP_WALLET_DIR = 'so.onekey.wallet/wallet-backups';

class CloudBackup {
  logoutFromGoogleDrive() {
    if (Platform.OS === 'android') {
      RNCloudFs.logout();
    }
  }

  async deleteAllBackups() {
    if (Platform.OS === 'android') {
      await RNCloudFs.loginIfNeeded();
    }
    const backups = await RNCloudFs.listFiles({
      scope: 'hidden',
      targetPath: REMOTE_BACKUP_WALLET_DIR,
    });
    await Promise.all(
      backups.files.map(async (file) => {
        await RNCloudFs.deleteFromCloud(file);
      }),
    );
  }

  async fetchAllBackups() {
    if (Platform.OS === 'android') {
      await RNCloudFs.loginIfNeeded();
    }
    return RNCloudFs.listFiles({
      scope: 'hidden',
      targetPath: REMOTE_BACKUP_WALLET_DIR,
    });
  }

  async encryptAndSaveDataToCloud(
    data: string,
    password: string,
    filename: string,
  ) {
    // Encrypt the data
    try {
      // const encryptedData = await encryptor.encrypt(
      //   password,
      //   JSON.stringify(data),
      // );
      const encryptedData = data;

      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      const path = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, encryptedData, {
        encoding: 'utf8',
      });
      const sourceUri = { path };
      const destinationPath = `${REMOTE_BACKUP_WALLET_DIR}/${filename}`;
      const mimeType = 'application/json';
      // Only available to our app
      const scope = 'hidden';
      if (Platform.OS === 'android') {
        await RNCloudFs.loginIfNeeded();
      }
      const result = await RNCloudFs.copyToCloud({
        mimeType,
        scope,
        sourcePath: sourceUri,
        targetPath: destinationPath,
      });

      const exists = await RNCloudFs.fileExists(
        Platform.OS === 'ios'
          ? {
              scope,
              targetPath: destinationPath,
            }
          : {
              fileId: result,
              scope,
            },
      );

      if (!exists) {
        console.error('error');
      }

      await FileSystem.deleteAsync(path);
      return filename;
    } catch (e) {
      return undefined;
    }
  }

  syncCloud() {
    return RNCloudFs.syncCloud();
  }

  getICloudDocument(filename: string) {
    return RNCloudFs.getIcloudDocument(filename);
  }

  getGoogleDriveDocument(id: string) {
    return RNCloudFs.getGoogleDriveDocument(id);
  }

  async getDataFromCloud(
    backupPassword: string,
    filename: string,
  ): Promise<string | undefined> {
    if (Platform.OS === 'android') {
      await RNCloudFs.loginIfNeeded();
    }
    const backups = await RNCloudFs.listFiles({
      scope: 'hidden',
      targetPath: REMOTE_BACKUP_WALLET_DIR,
    });
    if (!backups || !backups.files || !backups.files.length) {
      console.log('No backups found');
    }
    let document: FilesType | undefined;
    if (filename) {
      if (Platform.OS === 'ios') {
        // .icloud are files that were not yet synced
        document = backups.files.find(
          (file: FilesType) => file.name === filename,
        );
      } else {
        document = backups.files.find(
          (file: FilesType) =>
            file.name === `${REMOTE_BACKUP_WALLET_DIR}/${filename}`,
        );
      }

      if (!document) {
        console.log('No backup found with that name!', filename);
      }
    } else {
      const sortedBackups: FilesType[] = sortBy(
        backups.files,
        'lastModified',
      ).reverse();
      // eslint-disable-next-line prefer-destructuring
      document = sortedBackups[0];
    }
    if (document) {
      const encryptedData =
        Platform.OS === 'ios'
          ? await this.getICloudDocument(filename)
          : await this.getGoogleDriveDocument(document.id);

      if (encryptedData) {
        // TODO:
        // const backedUpDataStringified = await encryptor.decrypt(
        //   backupPassword,
        //   encryptedData,
        // );
        const backedUpDataStringified = encryptedData;

        if (backedUpDataStringified) {
          // TODO:
          // const backedUpData = JSON.parse(backedUpDataStringified);
          const backedUpData = backedUpDataStringified;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return backedUpData;
        }
        console.log('We couldnt decrypt the data');
      }
    }
    console.log('We couldnt get the encrypted data');
  }

  async backupUserDataIntoCloud(data: string) {
    const filename = USERDATA_FILE;
    const password = '';
    return this.encryptAndSaveDataToCloud(data, password, filename);
  }

  async fetchUserDataFromCloud() {
    const filename = USERDATA_FILE;
    const password = '';
    return this.getDataFromCloud(password, filename);
  }

  isCloudBackupAvailable() {
    if (Platform.OS === 'ios') {
      return RNCloudFs.isAvailable();
    }
    return true;
  }
}

const cloudBackup = new CloudBackup();
export default cloudBackup;
