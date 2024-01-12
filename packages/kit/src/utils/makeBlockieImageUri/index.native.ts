import makeBlockie from 'ethereum-blockies-base64';
import RNFS from 'react-native-fs';

import {
  BLOCKIE_IMAGE_BASE64_PREFIX,
  BLOCKIE_IMAGE_CACHE_DIR,
} from './BlockieImageCache.const';

export default function makeBlockieImageUri(id: string) {
  return new Promise<string>((resolve) => {
    const filepath = `${BLOCKIE_IMAGE_CACHE_DIR}/${encodeURIComponent(id)}.png`;

    const createNewEthBase64 = () => {
      const data = makeBlockie(id);
      // Don't need check, same as `mkdir -p`
      void RNFS.mkdir(BLOCKIE_IMAGE_CACHE_DIR).then(() => {
        void RNFS.write(
          filepath,
          // Although it's a bit complicated, we only decode base64 once to improve performance.
          data.replace(BLOCKIE_IMAGE_BASE64_PREFIX, ''),
          0,
          'base64',
        );
      });
      resolve(data);
    };
    RNFS.exists(filepath)
      .then((isExists) => {
        if (isExists) {
          resolve(filepath);
        } else {
          createNewEthBase64();
        }
      })
      .catch(() => {
        createNewEthBase64();
      });
  });
}
