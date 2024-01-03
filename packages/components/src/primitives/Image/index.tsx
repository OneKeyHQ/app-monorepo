import type { PropsWithChildren } from 'react';
import { useMemo, useState } from 'react';

import { Circle, withStaticProperties } from 'tamagui';

import { Stack } from '../Stack';

import { ImageContext } from './context';
import { ImageFallback, ImageSkeleton } from './ImageFallback';
import { ImageSource } from './ImageSource';

import type { IImageProps, IImageSourceProps } from './type';

function ImageContainer({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const value = useMemo(
    () => ({
      loading,
      setLoading,
    }),
    [loading],
  );
  return (
    <ImageContext.Provider value={value}>{children}</ImageContext.Provider>
  );
}

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
  Source: ImageSource,
  Fallback: ImageFallback,
  Skeleton: ImageSkeleton,
});

export type {
  IImageFallbackProps,
  IImageSourceProps,
  IImageProps,
  IImageSkeletonProps,
} from './type';
