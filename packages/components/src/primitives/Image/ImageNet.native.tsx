import type { IPreloadImageFunc, IPreloadImagesFunc } from './type';

export const ImageNet = () => {
  return null;
};

export const preloadImages: IPreloadImagesFunc = (sources) =>
  new Promise((resolve) => {
    // ImageNet.preload(sources);
    resolve();
  });

export const preloadImage: IPreloadImageFunc = (source) =>
  preloadImages([source]);
