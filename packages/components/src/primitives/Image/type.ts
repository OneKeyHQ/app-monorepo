import type { PropsWithChildren } from 'react';

import type { StackStyleProps } from '@tamagui/web/types/types';
import type { ImageProps, ImageSourcePropType } from 'react-native';

export type IImageContext = {
  loading?: boolean;
  setLoading?: (loading: boolean) => void;
};

export type IImageFallbackProps = PropsWithChildren<
  StackStyleProps & {
    delayMs?: number;
  }
>;

export type IImageSkeletonProps = Omit<IImageFallbackProps, 'children'>;

export type IImageSourceProps = Omit<ImageProps, 'width' | 'height'> &
  StackStyleProps & {
    delayMs?: number;
  };
export type IImageProps = PropsWithChildren<
  Omit<IImageSourceProps, 'source'> & {
    source?: IImageSourceProps['source'];
  }
>;

export type IUseSource = (
  source?: ImageSourcePropType,
) => ImageSourcePropType | undefined;
