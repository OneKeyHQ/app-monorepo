import makeBlockie from 'ethereum-blockies-base64';
import RNFS from 'react-native-fs';

// eslint-disable-next-line spellcheck/spell-checker
const BLOCKIE_IMAGE_CACHE_DIR = `file://${RNFS.DocumentDirectoryPath}/blockies_avatar_cache`;

export default function makeBlockieImageUri(id: string) {
  return new Promise<string>((resolve) => {
    const filepath = `${BLOCKIE_IMAGE_CACHE_DIR}/${id.replace('/', '_')}.png`;

    const createNewEthBase64 = () => {
      const data = makeBlockie(id);
      // Don't need check, same as `mkdir -p`
      void RNFS.mkdir(BLOCKIE_IMAGE_CACHE_DIR).then(() => {
        void RNFS.write(
          filepath,
          // Although it's a bit complicated, we only decode base64 once to improve performance.
          data.replace('data:image/png;base64,', ''),
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
