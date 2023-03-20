import { GoogleSignin } from '@react-native-community/google-signin';
import RNCloudFs from 'react-native-cloud-fs';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import platformEnv from '../platformEnv';

const GoogleSignInConfigure = {
  scopes: ['https://www.googleapis.com/auth/drive.file'],
  webClientId:
    '117481276073-fs7omuqsmvgtg6bci3ja1gvo03g0d984.apps.googleusercontent.com',
  offlineAccess: true,
};

export async function isAvailable(): Promise<boolean> {
  const hasPlayServices = await GoogleSignin.hasPlayServices({
    showPlayServicesUpdateDialog: false,
  });
  return Promise.resolve(hasPlayServices);
}

export async function loginIfNeeded(
  showSignInDialog: boolean,
): Promise<boolean> {
  const signedIn = await GoogleSignin.isSignedIn();
  if (signedIn) {
    try {
      return await RNCloudFs.loginIfNeeded();
    } catch (error) {
      debugLogger.cloudBackup.error(error);
      return Promise.resolve(false);
    }
  } else if (showSignInDialog) {
    try {
      GoogleSignin.configure(GoogleSignInConfigure);
      await GoogleSignin.signIn();
      return await RNCloudFs.loginIfNeeded();
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
  await loginIfNeeded(false);
  const { files }: { files: Array<{ isFile: boolean; name: string }> } =
    await RNCloudFs.listFiles({ scope: 'hidden', targetPath: target });
  return files.map(({ name }) => name);
}

async function getFileObject(
  target: string,
): Promise<{ id: string; name: string } | undefined> {
  const { files }: { files: Array<{ id: string; name: string }> } =
    await RNCloudFs.listFiles({
      scope: 'hidden',
      targetPath: target,
    });
  return files.find(({ name }) => target === name);
}
export async function deleteFile(target: string): Promise<boolean> {
  await loginIfNeeded(false);
  const file = await getFileObject(target);
  if (file) {
    await RNCloudFs.deleteFromCloud(file);
    return Promise.resolve(true);
  }
  return Promise.resolve(false);
}

export async function downloadFromCloud(target: string): Promise<string> {
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
