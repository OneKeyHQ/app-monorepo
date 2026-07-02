import type { PropsWithChildren } from 'react';

import type { StackStyle } from '@onekeyhq/components/src/shared/tamagui';

import type { IStackStyle } from '../Stack';
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

export type IPreloadImageOptions = {
  pixelRatio?: number;
};

type IPreloadImageSourceBase = {
  uri?: string;
  pixelRatio?: number;
};

export type IPreloadImageSource =
  | (IPreloadImageSourceBase & {
      optimize?: true;
      resizeWidth: number;
      width?: never;
      height?: never;
    })
  | (IPreloadImageSourceBase & {
      optimize?: true;
      resizeWidth?: never;
      width: number;
      height: number;
    })
  | (IPreloadImageSourceBase & {
      optimize: false;
      resizeWidth?: number;
      width?: number;
      height?: number;
    });

export type IPreloadImagesFunc = (
  sources: IPreloadImageSource[],
  options?: IPreloadImageOptions,
) => Promise<boolean>;

export type IPreloadImageFunc = (
  source: IPreloadImageSource,
  options?: IPreloadImageOptions,
) => Promise<boolean>;

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
    /** Display width hint in layout units. DPR is applied internally. */
    resizeWidth?: number;
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
    /** Whether the image can be retried
     * @default true
     */
    canRetry?: boolean;
    /** Whether to autoplay animated images (GIF, WebP)
     * @default true
     * @platform android
     * @platform ios
     */
    autoplay?: boolean;
  };

export type IImageProps = IImageV2Props;
