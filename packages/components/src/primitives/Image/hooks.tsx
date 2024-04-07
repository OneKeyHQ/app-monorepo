import { useMemo } from 'react';

import { Image } from 'react-native';

import { ImageNull } from './ImageNull';

import type { IUseImageComponent, IUseSource } from './type';
import type { ImageSourcePropType, ImageURISource } from 'react-native';

export const useSource: IUseSource = (source, src) =>
  useMemo(() => {
    if (!source && !src) {
      return;
    }
    if (src) {
      return {
        uri: src,
      };
    }
    const uriSource = source as ImageURISource;
    // ImageRequireSource will be convert to the link via Webpack
    return (uriSource.uri ? uriSource : { uri: source }) as ImageSourcePropType;
  }, [source, src]);

export const useImageComponent: IUseImageComponent = (imageSource) =>
  useMemo(() => {
    if (!imageSource) {
      return ImageNull as unknown as ReturnType<IUseImageComponent>;
    }
    return Image;
  }, [imageSource]);
