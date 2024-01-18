import { useEffect, useState } from 'react';

import makeBlockie from 'ethereum-blockies-base64';
import RNFS from 'react-native-fs';

import {
  BLOCKIE_IMAGE_BASE64_PREFIX,
  BLOCKIE_IMAGE_CACHE_DIR,
} from './BlockieImageCache.const';

import type { IUseBlockieImageUri } from './type';

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
async function makeBlockieImageUri(id: string) {
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

export const useBlockieImageUri: IUseBlockieImageUri = (id: string) => {
  const [uri, setUri] = useState(caches[id]);

  useEffect(() => {
    if (!uri) {
      makeBlockieImageUri(id)
        .then((imageUri: string) => {
          setUri(imageUri);
        })
        .catch((error) => {
          console.error(error);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return {
    uri,
  };
};
