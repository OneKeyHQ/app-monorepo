import { useMemo, useRef } from 'react';

import { Image } from 'react-native';

import { ImageNull } from './ImageNull';
import { useSourceKey, useSourceRef } from './utils';

import type { IUseImageComponent, IUseSource } from './type';
import type { ImageSourcePropType, ImageURISource } from 'react-native';

export const useSource: IUseSource = (source, src) => {
  const sourceKey = useSourceKey(source);
  const sourceRef = useSourceRef(source);
  return useMemo(() => {
    if (!sourceKey && !src) {
      return;
    }
    if (src) {
      return {
        uri: src.trim(),
      };
    }
    const uriSource = sourceRef.current as ImageURISource;
    // ImageRequireSource will be convert to the link via Webpack
    return (
      uriSource.uri
        ? {
            uri: uriSource.uri.trim(),
          }
        : {
            uri:
              typeof sourceRef.current === 'string'
                ? (sourceRef.current as string).trim()
                : sourceRef.current,
          }
    ) as ImageSourcePropType;
  }, [sourceKey, sourceRef, src]);
};

export const useImageComponent: IUseImageComponent = (imageSource) =>
  useMemo(() => {
    if (!imageSource) {
      return ImageNull as unknown as ReturnType<IUseImageComponent>;
    }
    return Image;
  }, [imageSource]);
