import { useImage } from 'expo-image';

import { withStaticProperties } from '@onekeyhq/components/src/shared/tamagui';

import { Image as ImageCore } from './Image';
import { ImageFallback } from './ImageFallback';
import { ImageLoading } from './ImageLoading';
import { ImageWithFallbackSources } from './ImageWithFallbackSources';
import { loadImage, preloadImage, preloadImages } from './preload';

export const Image = withStaticProperties(ImageCore, {
  Fallback: ImageFallback,
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
