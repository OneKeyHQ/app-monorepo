import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';
import RNShare from '@onekeyhq/shared/src/modules3rdParty/react-native-share';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IDownloadAsFileType } from './type';

export const downloadAsFile: IDownloadAsFileType = async ({
  content,
  filename,
}: {
  content: string;
  filename: string;
}) => {
  if (!RNFS) return;
  const filepath = `${RNFS.DocumentDirectoryPath}/${filename}`;
  // RNFS.stat will throw an error if the file does not exist on android
  const isExist = await RNFS.exists(filepath);
  if (isExist) {
    await RNFS.unlink(filepath);
  }
  await RNFS.writeFile(filepath, content, 'utf8');
  const RNShareFilePath = platformEnv.isNativeAndroid
    ? `file://${filepath}`
    : filepath;
  RNShare.open({
    url: RNShareFilePath,
    title: 'Custom Network Configs',
    filename,
  }).catch(() => {
    /** ignore */
  });
};
