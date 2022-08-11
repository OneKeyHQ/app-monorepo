import RNCloudFs from 'react-native-cloud-fs';

import platformEnv from '../platformEnv';

export async function isAvailable(): Promise<boolean> {
  return !!platformEnv.isNativeIOS && RNCloudFs.isAvailable();
}

export function sync(): Promise<boolean> {
  if (platformEnv.isNativeIOS) {
    return RNCloudFs.syncCloud();
  }
  return Promise.resolve(true);
}

export async function listFiles(target: string): Promise<Array<string>> {
  if (!platformEnv.isNativeIOS) {
    return Promise.resolve([]);
  }

  const { files }: { files: Array<{ isFile: boolean; name: string }> } =
    await RNCloudFs.listFiles({ scope: 'hidden', targetPath: target });
  return files.filter(({ isFile }) => isFile).map(({ name }) => name);
}

export async function deleteFile(target: string): Promise<boolean> {
  if (!platformEnv.isNativeIOS) {
    return Promise.resolve(false);
  }
  const {
    files: [file],
  }: { files: Array<{ isFile: boolean }> } = await RNCloudFs.listFiles({
    scope: 'hidden',
    targetPath: target,
  });
  if (file && file.isFile) {
    await RNCloudFs.deleteFromCloud(file);
    return Promise.resolve(true);
  }
  return Promise.resolve(false);
}

export function downloadFromCloud(filename: string): Promise<string> {
  return RNCloudFs.getIcloudDocument(filename);
}

export async function uploadToCloud(
  source: string,
  target: string,
): Promise<void> {
  if (!platformEnv.isNativeIOS) {
    return Promise.resolve();
  }
  await RNCloudFs.copyToCloud({
    mimeType: null,
    scope: 'hidden',
    sourcePath: { path: source },
    targetPath: target,
  });
}
