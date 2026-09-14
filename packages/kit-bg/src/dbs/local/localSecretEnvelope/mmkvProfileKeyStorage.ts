import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { ILocalSecretEnvelopeMmkvProfileKeyStorage } from './mmkvProfileKeyLayerAdapter';

const unavailableMmkvProfileKeyStorage: ILocalSecretEnvelopeMmkvProfileKeyStorage =
  {
    async getItem() {
      return null;
    },
    async getOrCreateItem() {
      throw new OneKeyLocalError(
        'Local secret envelope MMKV profile key storage is unavailable',
      );
    },
    async removeItem() {
      return undefined;
    },
    async setItem() {
      throw new OneKeyLocalError(
        'Local secret envelope MMKV profile key storage is unavailable',
      );
    },
    async supportStorage() {
      return false;
    },
  };

export default unavailableMmkvProfileKeyStorage;
