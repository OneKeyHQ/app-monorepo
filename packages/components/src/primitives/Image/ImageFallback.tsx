import { useContext } from 'react';

import { Skeleton } from '../Skeleton';
import { Stack } from '../Stack';

import { ImageContext } from './context';
import { useVisible } from './useVisible';

import type { IImageFallbackProps, IImageSkeletonProps } from './type';

/**
 * @deprecated Use Image.V2 instead. example: packages/kit/src/views/Developer/pages/Gallery/Components/stories/Image.tsx
 */
export function ImageFallback({
  delayMs = 80,
  children,
  ...props
}: IImageFallbackProps) {
  const { loadedSuccessfully } = useContext(ImageContext);

  const visible = useVisible(delayMs);
  return !loadedSuccessfully && !visible ? (
    <Stack
      position="absolute"
      bg="$bgApp"
      width="100%"
      height="100%"
      {...props}
    >
      {children}
    </Stack>
  ) : null;
}

/**
 * @deprecated Use Image.V2 instead. example: packages/kit/src/views/Developer/pages/Gallery/Components/stories/Image.tsx
 */
export function ImageSkeleton(props: IImageSkeletonProps) {
  return (
    <ImageFallback {...props}>
      <Skeleton width="100%" height="100%" />
    </ImageFallback>
  );
}
