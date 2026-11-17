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

type IPreloadRequest = Parameters<typeof OneKeyImageCache.preload>[0][number];

const MAX_CONCURRENT_PRELOADS = 4;

async function preloadWithConcurrency(
  preloadRequests: IPreloadRequest[],
): Promise<boolean> {
  let nextIndex = 0;
  let success = true;
  const preloadNext = async () => {
    while (nextIndex < preloadRequests.length) {
      const request = preloadRequests[nextIndex];
      nextIndex += 1;
      if (!(await OneKeyImageCache.preload([request]).catch(() => false))) {
        success = false;
      }
    }
  };
  await Promise.all(
    Array.from(
      {
        length: Math.min(MAX_CONCURRENT_PRELOADS, preloadRequests.length),
      },
      preloadNext,
    ),
  );
  return success;
}

export const preloadImages: IPreloadImagesFunc = async (sources, options) => {
  const hasInvalidSource = sources.some((source) => !source.uri?.trim());
  const preloadRequests = sources
    .filter((source): source is typeof source & { uri: string } =>
      Boolean(source.uri?.trim()),
    )
    .map((source) => ({
      // Match rendering: native chooses the rendition and handles raw fallback.
      uri: source.uri.trim(),
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
    }));
  const success = await preloadWithConcurrency(preloadRequests);
  return success && !hasInvalidSource;
};

export const preloadImage: IPreloadImageFunc = (source, options) =>
  preloadImages([source], options);
