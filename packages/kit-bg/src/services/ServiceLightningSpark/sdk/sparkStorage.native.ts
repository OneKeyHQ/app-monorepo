import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';

// Breez keeps a wallet's state in a directory; the app's documents directory
// is private to the app on both platforms.
function getFileSystem() {
  if (!RNFS) {
    throw new OneKeyLocalError('The file system module is not available');
  }
  return RNFS;
}

export async function resolveSparkStorageDir(name: string) {
  const fs = getFileSystem();
  const dir = `${fs.DocumentDirectoryPath}/${name}`;
  await fs.mkdir(dir);
  return dir;
}

/** Deletes every storage directory that `match` accepts. */
export async function removeSparkStorage(
  match: (storageDir: string) => boolean,
): Promise<void> {
  const fs = getFileSystem();
  const entries = await fs.readDir(fs.DocumentDirectoryPath);
  for (const entry of entries) {
    if (entry.isDirectory() && match(entry.name)) {
      await fs.unlink(entry.path);
    }
  }
}
