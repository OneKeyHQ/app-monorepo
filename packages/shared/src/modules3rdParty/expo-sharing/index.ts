import type { SharingOptions } from 'expo-sharing';

const mock = {
  shareAsync: async (url: string, options: SharingOptions = {}) => {
    throw new Error('Function not implemented.');
  },
  isAvailableAsync: async () => {
    throw new Error('Function not implemented.');
  },
};

// only native modules available, please check index.native.ts
export default mock;
