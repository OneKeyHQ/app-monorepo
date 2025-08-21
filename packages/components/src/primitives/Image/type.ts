import type { PropsWithChildren } from 'react';

import type { IStackStyle } from '../Stack';
import type { StackStyle } from '@tamagui/web';
import type {
  ImageErrorEventData,
  ImageLoadEventData,
  ImageProgressEventData,
  ImageProps,
} from 'expo-image';
import type { Image, ImageSourcePropType } from 'react-native';

export type IImageContext = {
  loading?: boolean;
  setLoading?: (loading: boolean) => void;
  loadedSuccessfully?: boolean;
  setLoadedSuccessfully?: (isSuccessful: boolean) => void;
};

export type IImageFallbackProps = PropsWithChildren<
  StackStyle & {
    /** Milliseconds to wait before showing the fallback, to prevent flicker */
    delayMs?: number;
  }
>;

export type IImageLoadingProps = IImageFallbackProps;

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

export type IUseSource = (
  source?: ImageSourcePropType,
  src?: string,
) => ImageSourcePropType | undefined;

export type IUseImageComponent = (
  imageSource?: ImageSourcePropType,
) => typeof Image;

export type IPreloadImagesFunc = (
  sources: { uri?: string }[],
) => Promise<boolean>;

export type IPreloadImageFunc = (source: { uri?: string }) => Promise<boolean>;

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
    /** Enable animated image support */
    animated?: boolean;
    size?: IStackStyle['height'];
    source?: ImageSourcePropType | string | number;
    skeleton?: React.ReactNode;
    fallback?: React.ReactNode;
    src?: string;
    /** Retry times when image loading fails, default is 5 */
    retryTimes?: number;
    onError?: (event: ImageErrorEventData) => void;
    onLoad?: (event: ImageLoadEventData) => void;
    onLoadEnd?: () => void;
    onLoadStart?: () => void;
    onDisplay?: () => void;
    resizeMode?: ImageProps['resizeMode'];
    tintColor?: ImageProps['tintColor'];
    onProgress?: (event: ImageProgressEventData) => void;
  };

export type IImageProps = IImageV2Props;
