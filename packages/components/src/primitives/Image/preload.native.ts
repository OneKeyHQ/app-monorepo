import {
  OneKeyImageCache,
  OneKeyImageCachePolicy,
} from '@onekeyfe/react-native-image';

import { hasCustomSourceIdentity } from './optimization';

import type { IPreloadImageFunc, IPreloadImagesFunc } from './type';

const CACHE_POLICIES = {
  disk: OneKeyImageCachePolicy.DISK,
  memory: OneKeyImageCachePolicy.MEMORY,
  'memory-disk': OneKeyImageCachePolicy.MEMORY_DISK,
  none: OneKeyImageCachePolicy.NONE,
} as const;

const MAX_CONCURRENT_PRELOADS = 4;

const preloadSource: IPreloadImageFunc = async (source, options) => {
  const uri = source.uri?.trim();
  if (!uri) return false;
  try {
    // Match rendering: native chooses the rendition and handles raw fallback.
    return await OneKeyImageCache.preload([
      {
        uri,
        headers: source.headers,
        cachePolicy: source.cachePolicy
          ? CACHE_POLICIES[source.cachePolicy]
          : OneKeyImageCachePolicy.MEMORY_DISK,
        resizeWidth: source.resizeWidth ?? source.width,
        resizeHeight: source.height,
        pixelRatio: source.pixelRatio ?? options?.pixelRatio,
        overscan: source.overscan,
        optimizeTos:
          source.optimize !== false && !hasCustomSourceIdentity(source),
      },
    ]);
  } catch {
    return false;
  }
};

export const preloadImages: IPreloadImagesFunc = async (sources, options) => {
  let nextIndex = 0;
  let success = true;
  const preloadNext = async () => {
    while (nextIndex < sources.length) {
      const source = sources[nextIndex];
      nextIndex += 1;
      if (!(await preloadSource(source, options))) {
        success = false;
        options?.onSourceError?.(source);
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_PRELOADS, sources.length) },
      preloadNext,
    ),
  );
  return success;
};

export const preloadImage: IPreloadImageFunc = (source, options) =>
  preloadImages([source], options);
