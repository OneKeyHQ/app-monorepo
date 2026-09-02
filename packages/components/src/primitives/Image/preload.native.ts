import {
  OneKeyImageCache,
  OneKeyImageCachePolicy,
} from '@onekeyfe/react-native-image';
import { PixelRatio } from 'react-native';

import type { IPreloadImageFunc, IPreloadImagesFunc } from './type';

const CACHE_POLICIES = {
  disk: OneKeyImageCachePolicy.DISK,
  memory: OneKeyImageCachePolicy.MEMORY,
  'memory-disk': OneKeyImageCachePolicy.MEMORY_DISK,
  none: OneKeyImageCachePolicy.NONE,
} as const;

export const preloadImages: IPreloadImagesFunc = (sources, options) => {
  return OneKeyImageCache.preload(
    sources
      .filter((source) => Boolean(source.uri))
      .map((source) => ({
        uri: source.uri,
        headers: source.headers,
        cachePolicy: source.cachePolicy
          ? CACHE_POLICIES[source.cachePolicy]
          : OneKeyImageCachePolicy.MEMORY_DISK,
        resizeWidth: source.resizeWidth ?? source.width,
        resizeHeight: source.height,
        pixelRatio:
          source.pixelRatio ?? options?.pixelRatio ?? PixelRatio.get(),
        overscan: source.overscan,
        optimizeTos: source.optimize !== false,
      })),
  );
};

export const preloadImage: IPreloadImageFunc = (source, options) =>
  preloadImages([source], options);
