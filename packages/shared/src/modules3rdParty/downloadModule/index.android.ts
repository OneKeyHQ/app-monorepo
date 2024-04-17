import { NativeModules } from 'react-native';

import RNFS from '../react-native-fs';

import type { IDownloadAPK, IInstallAPK } from './type';

const DIR_PATH = `file://${RNFS.CachesDirectoryPath}/apk`;
const buildFilePath = (version?: string) => `${DIR_PATH}/${version || ''}.apk`;

const { DownloadManager } = NativeModules as {
  DownloadManager: {
    installAPK: (path: string) => Promise<void>;
    downloadAPK: (url: string, filePath: string) => Promise<void>;
  };
};

export const downloadAPK: IDownloadAPK = async (downloadUrl, version) => {
  await RNFS?.mkdir(DIR_PATH);
  return downloadAPK(downloadUrl, buildFilePath(version));
};

export const installAPK: IInstallAPK = (version) =>
  DownloadManager.installAPK(buildFilePath(version));
