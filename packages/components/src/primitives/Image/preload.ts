import { Image } from 'expo-image';

import { DEFAULT_CACHE_POLICY } from './cachePolicy';

import type { IPreloadImageFunc, IPreloadImagesFunc } from './type';

export const preloadImages: IPreloadImagesFunc = (sources) =>
  Image.prefetch(sources.map((source) => source.uri).filter(Boolean), {
    cachePolicy: DEFAULT_CACHE_POLICY,
  });

export const preloadImage: IPreloadImageFunc = (source) =>
  preloadImages([source]);

export const loadImage = (source: { uri?: string }) => {
  if (!source.uri) {
    return Promise.resolve(null);
  }
  return Image.loadAsync(source.uri);
};
