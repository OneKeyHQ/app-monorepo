import type { PropsWithChildren } from 'react';
import { useMemo, useState } from 'react';

import { useImage } from 'expo-image';
import { Circle, withStaticProperties } from 'tamagui';

import { Stack } from '../Stack';

import { ImageContext } from './context';
import { ImageFallback, ImageSkeleton } from './ImageFallback';
import { ImageLoading } from './ImageLoading';
import { ImageSource } from './ImageSource';
import { ImageV2 } from './ImageV2';
import { loadImage, preloadImage, preloadImages } from './preload';

import type { IImageProps, IImageSourceProps } from './type';

function ImageContainer({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [loadedSuccessfully, setLoadedSuccessfully] = useState(false);
  const value = useMemo(
    () => ({
      loading,
      setLoading,
      loadedSuccessfully,
      setLoadedSuccessfully,
    }),
    [loadedSuccessfully, loading],
  );
  return (
    <ImageContext.Provider value={value}>{children}</ImageContext.Provider>
  );
}

/**
 * @deprecated Use Image.V2 instead. example: packages/kit/src/views/Developer/pages/Gallery/Components/stories/Image.tsx
 */
function BasicImage({
  children,
  size,
  width,
  height,
  circular,
  ...props
}: IImageProps) {
  const imageHeight = height || size;
  const imageWidth = width || size;
  const Container = circular ? Circle : Stack;
  return children ? (
    // @ts-expect-error
    <Container
      position="relative"
      width={imageWidth}
      height={imageHeight}
      overflow="hidden"
      {...props}
    >
      <ImageContainer>{children}</ImageContainer>
    </Container>
  ) : (
    <ImageSource
      width={imageWidth}
      height={imageHeight}
      {...(props as IImageSourceProps)}
    />
  );
}

export const Image = withStaticProperties(BasicImage, {
  V2: ImageV2,
  Source: ImageSource,
  Fallback: ImageFallback,
  Skeleton: ImageSkeleton,
  Loading: ImageLoading,
  useImage,
  preloadImage,
  preloadImages,
  loadImage,
});

export type { IImageV2Props } from './ImageV2';

export type {
  IImageFallbackProps,
  IImageSourceProps,
  IImageProps,
  IImageSkeletonProps,
  IImageLoadingProps,
} from './type';
