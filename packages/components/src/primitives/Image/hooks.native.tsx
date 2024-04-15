import { useMemo, useRef } from 'react';

import { Image } from 'react-native';

import { ImageNet } from './ImageNet';
import { ImageNull } from './ImageNull';
import { useSourceKey, useSourceRef } from './utils';

import type { IUseImageComponent, IUseSource } from './type';
import type { ImageURISource } from 'react-native';

export const useSource: IUseSource = (source, src) => {
  const sourceKey = useSourceKey(source);
  const sourceRef = useSourceRef(source);
  return useMemo(() => {
    if (!sourceKey && !src) {
      return;
    }
    if (src) {
      return {
        uri: src,
      };
    }

    if (
      typeof sourceRef.current === 'object' &&
      'uri' in (sourceRef.current as ImageURISource) &&
      !(sourceRef.current as ImageURISource).uri
    ) {
      return;
    }
    return sourceRef.current;
  }, [sourceKey, sourceRef, src]);
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
