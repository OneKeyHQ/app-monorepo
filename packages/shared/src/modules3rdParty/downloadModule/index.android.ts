import { NativeModules } from 'react-native';

import RNFS from '../react-native-fs';

import type { IDownloadAPK, IInstallAPK } from './type';

const DIR_PATH = `file://${RNFS.CachesDirectoryPath}/apk`;
const buildFilePath = (version: string) => `${DIR_PATH}/${version || ''}.apk`;

const { DownloadManager } = NativeModules as {
  DownloadManager: {
    installAPK: (path: string) => Promise<void>;
  };
};

export const downloadAPK: IDownloadAPK = async (
  downloadUrl: string,
  latestVersion: string,
) => {
  const dirPath = DIR_PATH;
  await RNFS?.mkdir(DIR_PATH);
  //   RNFS.downloadFile({
  //     fromUrl: appUpdateInfo.data.downloadUrl,
  //     toFile: `${dirPath}/${appUpdateInfo.data.latestVersion || ''}.apk`,
  //     progress: console.log,
  //   });
};

export const installAPK: IInstallAPK = (version: string) =>
  DownloadManager.installAPK(buildFilePath(version));
