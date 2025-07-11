import { Skeleton } from '../Skeleton';
import { Stack } from '../Stack';

import type { IImageFallbackProps, IImageSkeletonProps } from './type';

export function ImageFallback({ children, ...props }: IImageFallbackProps) {
  return (
    <Stack bg="$bgApp" {...props}>
      {children}
    </Stack>
  );
}

/**
 * @deprecated Use Image instead. example: packages/kit/src/views/Developer/pages/Gallery/Components/stories/Image.tsx
 */
export function ImageSkeleton(props: IImageSkeletonProps) {
  return (
    <ImageFallback {...props}>
      <Skeleton width="100%" height="100%" />
    </ImageFallback>
  );
}
