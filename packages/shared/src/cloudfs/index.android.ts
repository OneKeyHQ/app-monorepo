import { GoogleSignin } from '@react-native-community/google-signin';
import axios from 'axios';
import RNCloudFs from 'react-native-cloud-fs';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import platformEnv from '../platformEnv';

const GoogleSignInConfigure = {
  scopes: ['https://www.googleapis.com/auth/drive.file'],
  webClientId:
    '117481276073-fs7omuqsmvgtg6bci3ja1gvo03g0d984.apps.googleusercontent.com',
  offlineAccess: true,
};

export function backupPlatform() {
  return { cloudName: 'Google Drive', platform: 'Google' };
}

export async function isAvailable(): Promise<boolean> {
  const hasPlayServices = await GoogleSignin.hasPlayServices({
    showPlayServicesUpdateDialog: false,
  });
  return Promise.resolve(hasPlayServices);
}

async function checkInternet() {
  const result = await axios
    .head('https://www.googleapis.com/auth/drive.file', { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  return result;
}
export async function loginIfNeeded(
  showSignInDialog: boolean,
): Promise<boolean> {
  const signedIn = await GoogleSignin.isSignedIn();
  console.log('signedIn = ', signedIn);

  if (signedIn) {
    try {
      console.log('RNCloudFs');
      const login = await RNCloudFs.loginIfNeeded();
      console.log('login = ', login);

      return login;
    } catch (error) {
      debugLogger.cloudBackup.error(error);
      return Promise.resolve(false);
    }
  } else if (showSignInDialog) {
    try {
      GoogleSignin.configure(GoogleSignInConfigure);
      await GoogleSignin.signIn();
      const login = await RNCloudFs.loginIfNeeded();
      return login;
    } catch (error) {
      debugLogger.cloudBackup.error(error);
      return Promise.resolve(false);
    }
  }
  return Promise.resolve(false);
}

export function logoutFromGoogleDrive(): Promise<boolean> {
  if (platformEnv.isNativeAndroid) {
    return RNCloudFs.logout();
  }
  return Promise.resolve(true);
}

export function sync(): Promise<boolean> {
  return Promise.resolve(true);
}

export async function listFiles(target: string) {
  if ((await checkInternet()) === false) {
    return [];
  }
  await loginIfNeeded(false);
  const { files }: { files: Array<{ isFile: boolean; name: string }> } =
    await RNCloudFs.listFiles({ scope: 'hidden', targetPath: target });
  return files.map(({ name }) => name);
}

async function getFileObject(
  target: string,
): Promise<{ id: string; name: string } | undefined> {
  if ((await checkInternet()) === false) {
    return undefined;
  }
  const { files }: { files: Array<{ id: string; name: string }> } =
    await RNCloudFs.listFiles({
      scope: 'hidden',
      targetPath: target,
    });
  return files.find(({ name }) => target === name);
}

export async function deleteFile(target: string): Promise<boolean> {
  if ((await checkInternet()) === false) {
    return Promise.resolve(false);
  }
  await loginIfNeeded(false);
  const file = await getFileObject(target);
  if (file) {
    await RNCloudFs.deleteFromCloud(file);
    return Promise.resolve(true);
  }
  return Promise.resolve(false);
}

export async function downloadFromCloud(target: string): Promise<string> {
  if ((await checkInternet()) === false) {
    return Promise.resolve('');
  }
  await loginIfNeeded(false);
  const file = await getFileObject(target);
  if (file) {
    return RNCloudFs.getGoogleDriveDocument(file.id);
  }
  return Promise.resolve('');
}

export async function uploadToCloud(
  source: string,
  target: string,
): Promise<void> {
  await loginIfNeeded(false);
  await RNCloudFs.copyToCloud({
    mimeType: null,
    scope: 'hidden',
    sourcePath: { path: source },
    targetPath: target,
  });
}
