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

type IPreloadRequest = Parameters<typeof OneKeyImageCache.preload>[0][number];

type IOptimizedPreloadRequest = {
  rawUri: string;
  request: IPreloadRequest;
};

async function preloadWithRawFallback(
  preloadRequests: IOptimizedPreloadRequest[],
): Promise<boolean> {
  if (preloadRequests.length === 0) {
    return true;
  }
  const success = await OneKeyImageCache.preload(
    preloadRequests.map(({ request }) => request),
  ).catch(() => false);
  if (success) {
    return true;
  }
  if (preloadRequests.length === 1) {
    const [{ rawUri, request }] = preloadRequests;
    return OneKeyImageCache.preload([
      {
        ...request,
        uri: rawUri,
      },
    ]).catch(() => false);
  }

  const middleIndex = Math.ceil(preloadRequests.length / 2);
  const results = await Promise.all([
    preloadWithRawFallback(preloadRequests.slice(0, middleIndex)),
    preloadWithRawFallback(preloadRequests.slice(middleIndex)),
  ]);
  return results.every(Boolean);
}

export const preloadImages: IPreloadImagesFunc = async (sources, options) => {
  const preloadRequests = sources
    .filter((source): source is typeof source & { uri: string } =>
      Boolean(source.uri),
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
        enabled: source.optimize !== false,
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
  const optimizedPreloadRequests = preloadRequests.filter(
    ({ optimized }) => optimized,
  );
  const passthroughRequests = preloadRequests
    .filter(({ optimized }) => !optimized)
    .map(({ request }) => request);
  const [optimizedSuccess, passthroughSuccess] = await Promise.all([
    preloadWithRawFallback(optimizedPreloadRequests),
    passthroughRequests.length > 0
      ? OneKeyImageCache.preload(passthroughRequests).catch(() => false)
      : true,
  ]);
  return optimizedSuccess && passthroughSuccess;
};

export const preloadImage: IPreloadImageFunc = (source, options) =>
  preloadImages([source], options);
