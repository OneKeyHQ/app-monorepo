import FastImage from 'react-native-fast-image';

import type { IPreloadImageFunc, IPreloadImagesFunc } from './type';

export const ImageNet = FastImage;

export const preloadImages: IPreloadImagesFunc = (sources) =>
  new Promise((resolve) => {
    ImageNet.preload(sources);
    resolve();
  });

export const preloadImage: IPreloadImageFunc = (source) =>
  preloadImages([source]);
