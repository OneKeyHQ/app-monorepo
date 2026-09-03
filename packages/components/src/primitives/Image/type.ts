import type { PropsWithChildren } from 'react';

import type { StackStyle } from '@onekeyhq/components/src/shared/tamagui';

import type { IStackStyle } from '../Stack';
import type {
  Image,
  ImageProps,
  ImageSourcePropType,
  ImageURISource,
} from 'react-native';

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
  keyof StackStyle | 'source' | 'size'
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

export type IImageCachePolicy = 'memory-disk' | 'memory' | 'disk' | 'none';
export type IImageContentFit = 'cover' | 'contain' | 'fill' | 'center';
export type IImageCacheType = 'none' | 'disk' | 'memory';

export type IImageLoadEventData = {
  cacheType: IImageCacheType;
  source: {
    url: string;
    width: number;
    height: number;
  };
};

export type IImageErrorEventData = {
  error: string;
};

export type IPreloadImageOptions = {
  pixelRatio?: number;
};

type IPreloadImageSourceBase = {
  uri?: string;
  headers?: ImageURISource['headers'];
  cachePolicy?: IImageCachePolicy;
  pixelRatio?: number;
  overscan?: number;
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
  | keyof IStackStyle
  | 'source'
  | 'src'
  | 'pointerEvents'
  | 'onError'
  | 'onLoad'
  | 'resizeMode'
  | 'blurRadius'
  | 'capInsets'
  | 'defaultSource'
  | 'loadingIndicatorSource'
  | 'onPartialLoad'
  | 'progressiveRenderingEnabled'
  | 'resizeMethod'
  | 'tintColor'
  | 'onProgress'
> &
  IStackStyle & {
    size?: IStackStyle['height'];
    source?: ImageSourcePropType | string | number;
    /** Content shown while a non-null source is loading. */
    placeholder?: React.ReactNode;
    /** Content shown when source is unavailable or fails to load. */
    fallback?: React.ReactNode;
    src?: string;
    /** Display width hint in layout units. DPR is applied internally. */
    resizeWidth?: number;
    onError?: (event: IImageErrorEventData) => void;
    onLoad?: (event: IImageLoadEventData) => void;
    onLoadEnd?: () => void;
    onLoadStart?: () => void;
    onDisplay?: () => void;
    resizeMode?: ImageProps['resizeMode'];
    contentFit?: IImageContentFit;
    cachePolicy?: IImageCachePolicy;
    recyclingKey?: string;
    /** @deprecated ImageV2 does not support blur effects. */
    blurRadius?: never;
    /** @deprecated ImageV2 does not support image cap insets. */
    capInsets?: never;
    /** @deprecated ImageV2 does not support default image sources. Use placeholder instead. */
    defaultSource?: never;
    /** @deprecated ImageV2 does not support loading indicator image sources. Use placeholder instead. */
    loadingIndicatorSource?: never;
    /** @deprecated ImageV2 does not emit partial-load events. */
    onPartialLoad?: never;
    /** @deprecated ImageV2 does not support progressive rendering. */
    progressiveRenderingEnabled?: never;
    /** @deprecated ImageV2 manages resizing internally. */
    resizeMethod?: never;
    /** @deprecated ImageV2 does not support image tinting. Use the Icon component for tinted icons. */
    tintColor?: never;
    /** Number of retries after the original image request fails.
     * @default 1
     */
    retryTimes?: number;
    /** Whether failed image requests should be retried.
     * @default true
     */
    canRetry?: boolean;
    /** Whether to autoplay animated images (GIF, WebP).
     * @default false on Android, true on iOS
     */
    autoplay?: boolean;
  };

export type IImageProps = IImageV2Props;
