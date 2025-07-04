import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs/index.native';

console.log('RNFS', RNFS, RNFS.DocumentDirectoryPath);
export const SCREENSHOT_FOLDER = `${RNFS.DocumentDirectoryPath}/discovery/screenshot`;
