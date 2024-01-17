import makeBlockie from 'ethereum-blockies-base64';
import RNFS from 'react-native-fs';

import {
  BLOCKIE_IMAGE_BASE64_PREFIX,
  BLOCKIE_IMAGE_CACHE_DIR,
} from './BlockieImageCache.const';

const caches: Record<string, string> = {};

const writeBlockieImage = async (id: string, filepath: string) => {
  const data = makeBlockie(id);
  await RNFS.write(
    filepath,
    // Although it's a bit complicated, we only decode base64 once to improve performance.
    data.replace(BLOCKIE_IMAGE_BASE64_PREFIX, ''),
    0,
    'base64',
  );
};
export default async function makeBlockieImageUri(id: string) {
  if (caches[id]) {
    return caches[id];
  }
  await RNFS.mkdir(BLOCKIE_IMAGE_CACHE_DIR);
  const filepath = `${BLOCKIE_IMAGE_CACHE_DIR}/${encodeURIComponent(id)}.png`;
  const isExists = await RNFS.exists(filepath);
  if (!isExists) {
    await writeBlockieImage(id, filepath);
  }
  caches[id] = filepath;
  return filepath;
}
