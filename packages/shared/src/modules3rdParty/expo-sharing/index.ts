import { OneKeyPlainTextError } from '@onekeyhq/shared/src/errors';

import type { SharingOptions } from 'expo-sharing';

const mock = {
  shareAsync: async (url: string, _options: SharingOptions = {}) => {
    throw new OneKeyPlainTextError('Function not implemented.');
  },
  isAvailableAsync: async () => {
    throw new OneKeyPlainTextError('Function not implemented.');
  },
};

// only native modules available, please check index.native.ts
export default mock;
