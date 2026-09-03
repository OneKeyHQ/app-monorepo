import {
  OneKeyImageCache,
  OneKeyImageCachePolicy,
} from '@onekeyfe/react-native-image';
import { PixelRatio } from 'react-native';

import { buildTosImageResizeUrl } from '@onekeyhq/shared/src/utils/tosImageResizeUtils';

import { hasCustomSourceIdentity } from './optimization';

import type { IPreloadImageFunc, IPreloadImagesFunc } from './type';

const CACHE_POLICIES = {
  disk: OneKeyImageCachePolicy.DISK,
  memory: OneKeyImageCachePolicy.MEMORY,
  'memory-disk': OneKeyImageCachePolicy.MEMORY_DISK,
  none: OneKeyImageCachePolicy.NONE,
} as const;

type IPreloadRequest = Parameters<typeof OneKeyImageCache.preload>[0][number];

type IPreloadRequestEntry = {
  optimized: boolean;
  rawUri: string;
  request: IPreloadRequest;
};

const MAX_CONCURRENT_PRELOADS = 4;

async function preloadRequestWithRawFallback({
  optimized,
  rawUri,
  request,
}: IPreloadRequestEntry): Promise<boolean> {
  const success = await OneKeyImageCache.preload([request]).catch(() => false);
  if (success || !optimized) {
    return success;
  }
  return OneKeyImageCache.preload([
    {
      ...request,
      uri: rawUri,
    },
  ]).catch(() => false);
}

async function preloadWithConcurrency(
  preloadRequests: IPreloadRequestEntry[],
): Promise<boolean> {
  let nextIndex = 0;
  let success = true;
  const preloadNext = async () => {
    while (nextIndex < preloadRequests.length) {
      const request = preloadRequests[nextIndex];
      nextIndex += 1;
      if (!(await preloadRequestWithRawFallback(request))) {
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
    .map((source) => {
      const pixelRatio =
        source.pixelRatio ?? options?.pixelRatio ?? PixelRatio.get();
      const optimizedSource = buildTosImageResizeUrl({
        uri: source.uri,
        resizeWidth: source.resizeWidth,
        displayWidth: source.width,
        displayHeight: source.height,
        pixelRatio,
        enabled: source.optimize !== false && !hasCustomSourceIdentity(source),
        overscanRatio: source.overscan,
      });

      return {
        request: {
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
        },
        rawUri: source.uri,
        optimized: optimizedSource.optimized,
      };
    });
  const success = await preloadWithConcurrency(preloadRequests);
  return success && !hasInvalidSource;
};

export const preloadImage: IPreloadImageFunc = (source, options) =>
  preloadImages([source], options);
