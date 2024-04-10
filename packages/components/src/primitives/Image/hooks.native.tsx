import { useMemo } from 'react';

import { Image, ImageSourcePropType, type ImageURISource } from 'react-native';

import { ImageNet } from './ImageNet';
import { ImageNull } from './ImageNull';

import type { IUseImageComponent, IUseSource } from './type';

export const useSource: IUseSource = (source, src) => {
  if (!source && !src) {
    return;
  }
  if (src) {
    return {
      uri: src,
    };
  }

  if (
    typeof source === 'object' &&
    'uri' in (source as ImageURISource) &&
    !(source as ImageURISource).uri
  ) {
    return;
  }
  return source;
};

export const useImageComponent: IUseImageComponent = (imageSource) =>
  useMemo(() => {
    if (!imageSource) {
      return ImageNull as unknown as ReturnType<IUseImageComponent>;
    }
    const uri = (imageSource as ImageURISource).uri;
    return uri && typeof uri === 'string' && uri.startsWith('http')
      ? ImageNet
      : Image;
  }, [imageSource]);
