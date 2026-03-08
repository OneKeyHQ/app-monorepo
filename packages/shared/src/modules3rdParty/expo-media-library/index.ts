import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type * as MediaLibrary from 'expo-media-library';

const mock = {
  saveToLibraryAsync: async (_uri: string): Promise<void> => {
    throw new OneKeyLocalError(
      'Media library is only available on native platforms',
    );
  },
  requestPermissionsAsync: async (
    _writeOnly?: boolean,
  ): Promise<MediaLibrary.PermissionResponse> => {
    throw new OneKeyLocalError(
      'Media library is only available on native platforms',
    );
  },
  getPermissionsAsync: async (
    _writeOnly?: boolean,
  ): Promise<MediaLibrary.PermissionResponse> => {
    throw new OneKeyLocalError(
      'Media library is only available on native platforms',
    );
  },
};

export default mock;
export type { MediaLibrary };
