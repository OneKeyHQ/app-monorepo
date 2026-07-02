import { Image } from 'expo-image';
import { PixelRatio } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { buildTosImageResizeUrl } from '@onekeyhq/shared/src/utils/tosImageResizeUtils';

import {
  getMissingCachedImageUris,
  refreshCachedImagePath,
  refreshCachedImagePaths,
} from './cache';
import { DEFAULT_CACHE_POLICY } from './cachePolicy';

import type {
  IPreloadImageFunc,
  IPreloadImageOptions,
  IPreloadImageSource,
  IPreloadImagesFunc,
} from './type';

const SHOULD_OPTIMIZE_RELATIVE_URL =
  platformEnv.isWeb || platformEnv.isWebEmbed;

function getPreloadUri(
  source: IPreloadImageSource,
  options?: IPreloadImageOptions,
) {
  const { uri } = source;
  if (!uri) {
    return undefined;
  }

  if (source.optimize === false) {
    return uri;
  }

  const result = buildTosImageResizeUrl({
    uri,
    resizeWidth: source.resizeWidth,
    displayWidth: source.width,
    displayHeight: source.height,
    pixelRatio:
      source.pixelRatio ??
      options?.pixelRatio ??
      (PixelRatio as { get?: () => number } | undefined)?.get?.() ??
      1,
    allowRelativeUrl: SHOULD_OPTIMIZE_RELATIVE_URL,
  });

  return result.uri ?? uri;
}

export const preloadImages: IPreloadImagesFunc = async (sources, options) => {
  const uris = sources
    .map((source) => getPreloadUri(source, options))
    .filter((uri): uri is string => Boolean(uri));
  if (!uris.length) {
    return true;
  }
  await refreshCachedImagePaths(uris);
  const missingUris = getMissingCachedImageUris(uris);
  if (!missingUris.length) {
    return true;
  }
  const success = await Image.prefetch(missingUris, {
    cachePolicy: DEFAULT_CACHE_POLICY,
  });
  if (success) {
    await refreshCachedImagePaths(missingUris);
  }
  return success;
};

export const preloadImage: IPreloadImageFunc = (source, options) =>
  preloadImages([source], options);

export const loadImage = (source: { uri?: string }) => {
  if (!source.uri) {
    return Promise.resolve(null);
  }
  return Image.loadAsync(source.uri).then(async (imageRef) => {
    await refreshCachedImagePath(source.uri);
    return imageRef;
  });
};
