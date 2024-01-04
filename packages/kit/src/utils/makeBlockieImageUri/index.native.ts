import makeBlockie from 'ethereum-blockies-base64';
import RNFS from 'react-native-fs';

export default function makeBlockieImageUri(id: string) {
  return new Promise<string>((resolve) => {
    const filepath = `${RNFS.CachesDirectoryPath}/eth_base64_cache_${id}.png`;

    const createNewEthBase64 = () => {
      const data = makeBlockie(id);
      void RNFS.write(
        filepath,
        // Although it's a bit complicated, we only decode base64 once to improve performance.
        data.replace('data:image/png;base64,', ''),
        0,
        'base64',
      );
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
