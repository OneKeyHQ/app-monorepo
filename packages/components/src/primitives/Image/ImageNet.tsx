import { Image as RNImage } from 'react-native';

import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { IPreloadImageFunc, IPreloadImagesFunc } from './type';

export const ImageNet = RNImage;

const loadImage = (uri: string) =>
  new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve();
    };
    image.onerror = reject;
    image.src = uri;
  });

const resolveMap = new Map<string, [() => void, (error: unknown) => void][]>();

export const preloadImage: IPreloadImageFunc = async (source) => {
  const { uri } = source;
  if (uri) {
    if (resolveMap.has(uri)) {
      return Promise.race([
        new Promise<void>((resolve, reject) => {
          resolveMap.get(uri)?.push([resolve, reject]);
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => {
            reject();
          }, timerUtils.getTimeDurationMs({ seconds: 10 }));
        }),
      ]);
    }
    try {
      resolveMap.set(uri, []);
      await loadImage(uri);
      resolveMap.get(uri)?.forEach((i) => i[0]());
    } catch (error) {
      resolveMap.get(uri)?.forEach((i) => i[1](error));
      throw error;
    } finally {
      resolveMap.delete(uri);
    }
  }
};

export const preloadImages: IPreloadImagesFunc = async (sources) => {
  await Promise.all(sources.map((i) => (i.uri ? loadImage(i.uri) : undefined)));
};
