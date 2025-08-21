import type * as RNFS from 'react-native-fs';

const module: typeof RNFS | undefined = {
  DocumentDirectoryPath: '',
  CachesDirectoryPath: '',
  exists: async () => false,
  mkdir: async () => {},
  unlink: async () => {},
  moveFile: async () => {},
  write: async () => {},
  writeFile: async () => {},
  readFile: async () => '',
  read: async () => '',
  readDir: async () => [],
  stat: async () => ({
    isDirectory: () => false,
    isFile: () => false,
    size: 0,
    lastModified: 0,
  }),
} as any;
export default module;
