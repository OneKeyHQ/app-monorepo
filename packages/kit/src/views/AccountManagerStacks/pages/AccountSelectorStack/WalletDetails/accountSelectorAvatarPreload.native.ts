import { Image } from '@onekeyhq/components';

import type { ImageSource } from '@onekeyfe/react-native-native-list';

export function preloadAccountSelectorAvatarImages(
  sources: readonly ImageSource[],
): Promise<boolean> {
  return Image.preloadImages(
    sources.map((source) => ({
      ...source,
      optimize: source.optimizeTos,
    })),
  );
}
