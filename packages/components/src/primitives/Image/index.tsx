import { withStaticProperties } from '@onekeyhq/components/src/shared/tamagui';

import { clearDiskCache, clearMemoryCache } from './cacheControl';
import { ImageFallback, ImageSkeleton } from './ImageFallback';
import { ImageLoading } from './ImageLoading';
import { ImageV2 } from './ImageV2';
import { ImageWithFallbackSources } from './ImageWithFallbackSources';
import { preloadImage, preloadImages } from './preload';

export const Image = withStaticProperties(ImageV2, {
  Fallback: ImageFallback,
  Skeleton: ImageSkeleton,
  Loading: ImageLoading,
  WithFallbackSources: ImageWithFallbackSources,
  preloadImage,
  preloadImages,
  clearDiskCache,
  clearMemoryCache,
});

export type {
  IImageFallbackProps,
  IImageSourceProps,
  IImageProps,
  IImageSkeletonProps,
  IImageLoadingProps,
  IPreloadImageSource,
  IPreloadImageOptions,
} from './type';
export type { IImageWithFallbackSourcesProps } from './ImageWithFallbackSources';
