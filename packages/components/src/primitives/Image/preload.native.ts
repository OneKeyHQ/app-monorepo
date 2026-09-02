import {
  OneKeyImageCache,
  OneKeyImageCachePolicy,
} from '@onekeyfe/react-native-image';
import { PixelRatio } from 'react-native';

import { buildTosImageResizeUrl } from '@onekeyhq/shared/src/utils/tosImageResizeUtils';

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
      .map((source) => {
        const pixelRatio =
          source.pixelRatio ?? options?.pixelRatio ?? PixelRatio.get();
        const optimizedSource = buildTosImageResizeUrl({
          uri: source.uri,
          resizeWidth: source.resizeWidth,
          displayWidth: source.width,
          displayHeight: source.height,
          pixelRatio,
          enabled: source.optimize !== false,
          overscanRatio: source.overscan,
        });

        return {
          uri: optimizedSource.uri ?? source.uri,
          headers: source.headers,
          cachePolicy: source.cachePolicy
            ? CACHE_POLICIES[source.cachePolicy]
            : OneKeyImageCachePolicy.MEMORY_DISK,
          resizeWidth: source.resizeWidth ?? source.width,
          resizeHeight: source.height,
          pixelRatio,
          overscan: source.overscan,
          optimizeTos: false,
        };
      }),
  ).catch(() => false);
};

export const preloadImage: IPreloadImageFunc = (source, options) =>
  preloadImages([source], options);
