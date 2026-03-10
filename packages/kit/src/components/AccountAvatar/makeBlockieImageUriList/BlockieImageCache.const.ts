import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';

// oxlint-disable-next-line @cspell/spellchecker
export const BLOCKIE_IMAGE_CACHE_DIR = `file://${
  RNFS?.DocumentDirectoryPath ?? ''
}/blockies_avatar_cache`;

export const BLOCKIE_IMAGE_BASE64_PREFIX = 'data:image/png;base64,';
