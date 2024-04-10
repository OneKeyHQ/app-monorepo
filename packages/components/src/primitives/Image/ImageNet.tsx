import { Image as RNImage } from 'react-native';

import type { IPreloadFunc } from './type';

export const ImageNet = RNImage;

const loadImage = (uri?: string) =>
  uri
    ? new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          resolve();
        };
        image.onerror = reject;
        image.src = uri;
      })
    : Promise.resolve();

export const preload: IPreloadFunc = async (sources) => {
  await Promise.all(sources.map((i) => loadImage(i.uri)));
};
