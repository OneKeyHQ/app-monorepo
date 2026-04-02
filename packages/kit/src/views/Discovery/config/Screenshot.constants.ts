import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';

export const SCREENSHOT_FOLDER = RNFS
  ? `${RNFS.DocumentDirectoryPath}/discovery/screenshot`
  : '';
