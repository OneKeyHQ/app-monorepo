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

export type IImageSourceProps = Omit<
  ImageProps,
  'width' | 'height' | 'source'
> &
  StackStyleProps & {
    delayMs?: number;
    src?: string;
    source?: ImageProps['source'];
  };
export type IImageProps = PropsWithChildren<IImageSourceProps>;

export type IUseSource = (
  source?: ImageSourcePropType,
  src?: string,
) => ImageSourcePropType | undefined;
