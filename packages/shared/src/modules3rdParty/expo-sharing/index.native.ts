import { isAvailableAsync, shareAsync } from 'expo-sharing';

import type { SharingOptions } from 'expo-sharing';

const mock = {
  shareAsync: async (url: string, options: SharingOptions = {}) =>
    shareAsync(url, options),
  isAvailableAsync: async () => isAvailableAsync(),
};

// only native modules available, please check index.native.ts
export default mock;
