import RNShare from '@onekeyhq/shared/src/modules3rdParty/expo-sharing';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export async function downloadAsFile({
  content,
  filename,
}: {
  content: string;
  filename: string;
}): Promise<void> {
  if (!RNFS) {
    return;
  }

  const filepath = `${RNFS.DocumentDirectoryPath}/${filename}`;
  if (await RNFS.exists(filepath)) {
    await RNFS.unlink(filepath);
  }
  await RNFS.writeFile(filepath, content, 'utf8');

  const sharePath = platformEnv.isNativeAndroid
    ? `file://${filepath}`
    : filepath;
  try {
    await RNShare.shareAsync(sharePath, {
      dialogTitle: 'OneKey Cloud Backup',
      mimeType: 'application/json',
      UTI: 'public.json',
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
