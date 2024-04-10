import type { PropsWithChildren } from 'react';

import type { StackStyleProps } from '@tamagui/web/types/types';
import type { Image, ImageProps, ImageSourcePropType } from 'react-native';
import type { FastImageStaticProperties } from 'react-native-fast-image';

export type IImageContext = {
  loading?: boolean;
  setLoading?: (loading: boolean) => void;
  loadedSuccessfully?: boolean;
  setLoadedSuccessfully?: (isSuccessful: boolean) => void;
};

export type IImageFallbackProps = PropsWithChildren<
  StackStyleProps & {
    /** Milliseconds to wait before showing the fallback, to prevent flicker */
    delayMs?: number;
  }
>;

export type IImageLoadingProps = IImageFallbackProps;

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

export type IUseImageComponent = (
  imageSource?: ImageSourcePropType,
) => typeof Image;

export type IPreloadFunc = (sources: { uri?: string }[]) => Promise<void>;
