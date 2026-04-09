import { useImage } from 'expo-image';

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
});

export type {
  IImageFallbackProps,
  IImageSourceProps,
  IImageProps,
  IImageSkeletonProps,
  IImageLoadingProps,
} from './type';
export type { IImageWithFallbackSourcesProps } from './ImageWithFallbackSources';
