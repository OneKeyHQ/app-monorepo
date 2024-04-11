import { useMemo } from 'react';

import { Image } from 'react-native';

import { ImageNull } from './ImageNull';
import { getSourceKey } from './utils';

import type { IUseImageComponent, IUseSource } from './type';
import type { ImageSourcePropType, ImageURISource } from 'react-native';

export const useSource: IUseSource = (source, src) => {
  const sourceKey = getSourceKey(source);
  return useMemo(() => {
    if (!source && !src) {
      return;
    }
    if (src) {
      return {
        uri: src.trim(),
      };
    }
    const uriSource = source as ImageURISource;
    // ImageRequireSource will be convert to the link via Webpack
    return (
      uriSource.uri
        ? {
            uri: uriSource.uri.trim(),
          }
        : {
            uri:
              typeof source === 'string' ? (source as string).trim() : source,
          }
    ) as ImageSourcePropType;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, src]);
};

export const useImageComponent: IUseImageComponent = (imageSource) =>
  useMemo(() => {
    if (!imageSource) {
      return ImageNull as unknown as ReturnType<IUseImageComponent>;
    }
    return Image;
  }, [imageSource]);
