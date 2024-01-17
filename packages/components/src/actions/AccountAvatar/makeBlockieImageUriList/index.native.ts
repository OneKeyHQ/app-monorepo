import makeBlockie from 'ethereum-blockies-base64';
import RNFS from 'react-native-fs';

import {
  BLOCKIE_IMAGE_BASE64_PREFIX,
  BLOCKIE_IMAGE_CACHE_DIR,
} from './BlockieImageCache.const';

export default function makeBlockieImageUri(id: string) {
  return RNFS.mkdir(BLOCKIE_IMAGE_CACHE_DIR).then(
    () =>
      new Promise<string>((resolve) => {
        const filepath = `${BLOCKIE_IMAGE_CACHE_DIR}/${encodeURIComponent(
          id,
        )}.png`;

        const createNewEthBase64 = () => {
          const data = makeBlockie(id);
          const writeCacheData = () => {
            void RNFS.write(
              filepath,
              // Although it's a bit complicated, we only decode base64 once to improve performance.
              data.replace(BLOCKIE_IMAGE_BASE64_PREFIX, ''),
              0,
              'base64',
            );
          };
          writeCacheData();
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
      }),
  );
}
