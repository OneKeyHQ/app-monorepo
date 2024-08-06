import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';
import RNShare from '@onekeyhq/shared/src/modules3rdParty/react-native-share';

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
  const statResult = await RNFS.stat(filepath);
  const isFile = statResult.isFile();
  //   if file exists, delete it
  if (isFile) {
    await RNFS.unlink(filepath);
  }
  await RNFS.writeFile(filepath, content, 'utf8');
  RNShare.open({
    url: filepath,
    title: 'Custom Network Configs',
    filename,
  }).catch(() => {
    /** ignore */
  });
};
