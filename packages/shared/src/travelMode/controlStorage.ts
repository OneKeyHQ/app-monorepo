import type { ITravelModeControlStorage } from './types';

const unsupportedStorage: ITravelModeControlStorage = {
  async getItem() {
    return null;
  },
  async removeItem() {},
  async setItem() {},
};

export default unsupportedStorage;
