import { GoogleSignin } from '@react-native-google-signin/google-signin';
import RNCloudFs from 'react-native-cloud-fs';

// import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { GoogleSignInConfigure } from '../consts/googleSignConsts';
import googlePlayService from '../googlePlayService/googlePlayService';
import platformEnv from '../platformEnv';

export function backupPlatform() {
  return { cloudName: 'Google Drive', platform: 'Google' };
}

export async function isAvailable(): Promise<boolean> {
  return googlePlayService.isAvailable();
}

export async function loginIfNeeded(
  showSignInDialog: boolean,
): Promise<boolean> {
  const signedIn = await GoogleSignin.isSignedIn();
  if (signedIn) {
    try {
      return await RNCloudFs.loginIfNeeded();
    } catch (error) {
      // debugLogger.cloudBackup.error(error);
      return Promise.resolve(false);
    }
  } else if (showSignInDialog) {
    GoogleSignin.configure(GoogleSignInConfigure);
    await GoogleSignin.signIn();
    return RNCloudFs.loginIfNeeded();
  }
  return Promise.resolve(false);
}

export async function logoutFromGoogleDrive(
  revokeAccess: boolean,
): Promise<boolean> {
  if (platformEnv.isNativeAndroid) {
    if (revokeAccess) {
      await GoogleSignin.revokeAccess();
    }
    await GoogleSignin.signOut();
    return RNCloudFs.logout();
  }
  return Promise.resolve(true);
}

export function sync(): Promise<boolean> {
  return Promise.resolve(true);
}

export async function listFiles(target: string) {
  await loginIfNeeded(false);
  const { files } = await RNCloudFs.listFiles({
    scope: 'hidden',
  });
  return files.map(({ name }) => name.replace(target, ''));
}

async function getFileObject(
  target: string,
): Promise<{ id: string; name: string } | undefined> {
  const { files }: { files: Array<{ id: string; name: string }> } =
    await RNCloudFs.listFiles({
      scope: 'hidden',
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
    scope: 'hidden',
    sourcePath: { path: source },
    targetPath: target,
  });
}
