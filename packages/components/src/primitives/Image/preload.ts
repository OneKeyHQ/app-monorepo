import { Image } from 'expo-image';

import {
  getMissingCachedImageUris,
  refreshCachedImagePath,
  refreshCachedImagePaths,
} from './cache';
import { DEFAULT_CACHE_POLICY } from './cachePolicy';

import type { IPreloadImageFunc, IPreloadImagesFunc } from './type';

export const preloadImages: IPreloadImagesFunc = async (sources) => {
  const uris = sources
    .map((source) => source.uri)
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

export const preloadImage: IPreloadImageFunc = (source) =>
  preloadImages([source]);

export const loadImage = (source: { uri?: string }) => {
  if (!source.uri) {
    return Promise.resolve(null);
  }
  return Image.loadAsync(source.uri).then(async (imageRef) => {
    await refreshCachedImagePath(source.uri);
    return imageRef;
  });
};
