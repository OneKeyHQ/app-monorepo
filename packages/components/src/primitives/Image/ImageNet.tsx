import { Image } from 'react-native';

import type { IPreloadFunc } from './type';

export const ImageNet = Image;

export const preload: IPreloadFunc = (sources) => {
  sources.forEach(({ uri, headers }) => {
    if (uri) {
      void fetch(uri, { headers });
    }
  });
};
