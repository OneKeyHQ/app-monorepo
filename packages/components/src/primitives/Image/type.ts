import type { PropsWithChildren } from 'react';

import type { StackStyle } from '@onekeyhq/components/src/shared/tamagui';

import type { IStackStyle } from '../Stack';
import type {
  ImageErrorEventData,
  ImageLoadEventData,
  ImageProgressEventData,
  ImageProps,
} from 'expo-image';
import type { ImageSourcePropType } from 'react-native';

export type IImageFallbackProps = PropsWithChildren<
  StackStyle & {
    /** Milliseconds to wait before showing the fallback, prevents flicker */
    delayMs?: number;
  }
>;

export type IImageLoadingProps = IImageFallbackProps;

/** @deprecated kept for backwards compatibility; use `Image.Fallback`. */
export type IImageSkeletonProps = Omit<IImageFallbackProps, 'children'>;

export type IImageSourcePropType = ImageProps['source'];

export type IImageSourceProps = Omit<
  ImageProps,
  'width' | 'height' | 'source' | 'borderRadius' | 'size'
> & {
  circular?: boolean;
  delayMs?: number;
  src?: string;
  source?: IImageSourcePropType;
  size?: StackStyle['width'];
} & StackStyle;

export type IImageV2Props = Omit<
  ImageProps,
  | 'source'
  | 'src'
  | 'pointerEvents'
  | 'onError'
  | 'onLoad'
  | 'resizeMode'
  | 'tintColor'
  | 'onProgress'
> &
  IStackStyle & {
    size?: IStackStyle['height'];
    source?: ImageSourcePropType | string | number;
    src?: string;
    skeleton?: React.ReactNode;
    fallback?: React.ReactNode;
    onError?: (event: ImageErrorEventData) => void;
    onLoad?: (event: ImageLoadEventData) => void;
    onLoadEnd?: () => void;
    onLoadStart?: () => void;
    onDisplay?: () => void;
    onProgress?: (event: ImageProgressEventData) => void;
    resizeMode?: ImageProps['resizeMode'];
    tintColor?: ImageProps['tintColor'];
    /** Whether to autoplay animated images (GIF, WebP).
     * @default true on iOS, false on Android (OOM protection)
     */
    autoplay?: boolean;
  };

export type IImageProps = IImageV2Props;
