import * as NativeListModule from '@onekeyfe/react-native-native-list';

import type { ImageSource } from '@onekeyfe/react-native-native-list';

interface INativeListAvatarPreloadModule {
  preloadNativeListAvatarImages: (
    sources: readonly ImageSource[],
  ) => Promise<unknown>;
}

const { preloadNativeListAvatarImages } =
  NativeListModule as unknown as INativeListAvatarPreloadModule;

export function preloadAccountSelectorAvatarImages(
  sources: readonly ImageSource[],
): Promise<unknown> {
  return preloadNativeListAvatarImages(sources);
}
