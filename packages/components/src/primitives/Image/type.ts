import type { PropsWithChildren } from 'react';

import type { StackStyleProps } from '@tamagui/web/types/types';
import type { ImageProps, ImageSourcePropType } from 'react-native';

export type IImageContext = {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  loadedSuccessfully: boolean;
  setLoadedSuccessfully: (isSuccessful: boolean) => void;
};

export type IImageFallbackProps = PropsWithChildren<
  StackStyleProps & {
    /** Milliseconds to wait before showing the fallback, to prevent flicker */
    delayMs?: number;
  }
>;

export type IImageSkeletonProps = Omit<IImageFallbackProps, 'children'>;

export type IImageSourceProps = Omit<
  ImageProps,
  'width' | 'height' | 'source' | 'borderRadius' | 'size'
> & {
  circular?: boolean;
  delayMs?: number;
  src?: string;
  source?: ImageProps['source'];
  size?: StackStyleProps['width'];
} & StackStyleProps;
export type IImageProps = PropsWithChildren<IImageSourceProps>;

export type IUseSource = (
  source?: ImageSourcePropType,
  src?: string,
) => ImageSourcePropType | undefined;
