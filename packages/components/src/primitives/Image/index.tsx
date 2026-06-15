import { Image as ExpoImage, useImage } from 'expo-image';

import { withStaticProperties } from '@onekeyhq/components/src/shared/tamagui';

import { ImageFallback, ImageSkeleton } from './ImageFallback';
import { ImageLoading } from './ImageLoading';
import { ImageV2 } from './ImageV2';
import { ImageWithFallbackSources } from './ImageWithFallbackSources';
import { loadImage, preloadImage, preloadImages } from './preload';

export const Image = withStaticProperties(ImageV2, {
  Fallback: ImageFallback,
  Skeleton: ImageSkeleton,
  Loading: ImageLoading,
  WithFallbackSources: ImageWithFallbackSources,
  useImage,
  preloadImage,
  preloadImages,
  loadImage,
  // Expose expo-image's cache controls so the "Clear cache" flow can purge the
  // image disk cache. There is NO native hard size cap in this build — eviction
  // relies on expo-image's default age-based policy (a size ceiling is deferred
  // to a follow-up). Native-only effect; no-op on web. Wrapped in arrows so the
  // static methods aren't passed as unbound references.
  clearDiskCache: () => ExpoImage.clearDiskCache(),
  clearMemoryCache: () => ExpoImage.clearMemoryCache(),
});

export type {
  IImageFallbackProps,
  IImageSourceProps,
  IImageProps,
  IImageSkeletonProps,
  IImageLoadingProps,
} from './type';
export type { IImageWithFallbackSourcesProps } from './ImageWithFallbackSources';
