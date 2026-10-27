import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import RNShare from '@onekeyhq/shared/src/modules3rdParty/expo-sharing';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export async function downloadAsFile({
  content,
  filename,
  encoding = 'utf8',
  mimeType = 'application/json',
  UTI = 'public.json',
}: {
  content: string;
  filename: string;
  encoding?: 'utf8' | 'base64';
  mimeType?: string;
  UTI?: string;
}): Promise<void> {
  if (!RNFS) {
    throw new OneKeyLocalError('File export is unavailable');
  }

  const filepath = `${RNFS.CachesDirectoryPath}/${filename}`;
  if (await RNFS.exists(filepath)) {
    await RNFS.unlink(filepath);
  }

  const sharePath = platformEnv.isNativeAndroid
    ? `file://${filepath}`
    : filepath;
  try {
    await RNFS.writeFile(filepath, content, encoding);
    await RNShare.shareAsync(sharePath, {
      dialogTitle: 'OneKey Cloud Backup',
      mimeType,
      UTI,
    });
  } finally {
    try {
      if (await RNFS.exists(filepath)) {
        await RNFS.unlink(filepath);
      }
    } catch {
      // Sharing has already completed; cleanup is best effort.
    }
  }
}
