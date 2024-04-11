import { useMemo } from 'react';

import { Image } from 'react-native';

import { ImageNet } from './ImageNet';
import { ImageNull } from './ImageNull';
import { getSourceKey } from './utils';

import type { IUseImageComponent, IUseSource } from './type';
import type { ImageURISource } from 'react-native';

export const useSource: IUseSource = (source, src) => {
  const sourceKey = getSourceKey(source);
  return useMemo(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, src]);
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
