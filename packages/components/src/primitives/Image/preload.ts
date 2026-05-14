import { Image } from 'expo-image';

import { DEFAULT_CACHE_POLICY } from './cachePolicy';

export const preloadImages = (sources: { uri?: string }[]): Promise<boolean> =>
  Image.prefetch(
    sources.map((source) => source.uri).filter((uri): uri is string => !!uri),
    { cachePolicy: DEFAULT_CACHE_POLICY },
  );

export const preloadImage = (source: { uri?: string }): Promise<boolean> =>
  preloadImages([source]);

export const loadImage = (source: { uri?: string }) => {
  if (!source.uri) return Promise.resolve(null);
  return Image.loadAsync(source.uri);
};
