import { useContext, useEffect, useState } from 'react';

import { Skeleton } from '../Skeleton';
import { Stack } from '../Stack';

import { ImageContext } from './context';

import type { IImageFallbackProps, IImageSkeletonProps } from './type';

const useVisible = (delayMs: number) => {
  const [visible, setVisible] = useState(!(delayMs > 0));
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;
    if (delayMs > 0) {
      timerId = setTimeout(() => {
        setVisible(true);
      }, delayMs);
    }
    return () => {
      clearTimeout(timerId);
    };
  }, [delayMs]);
  const { loading, loadedSuccessfully } = useContext(ImageContext);
  return (loading || !loadedSuccessfully) && visible;
};
export function ImageFallback({
  delayMs = 80,
  children,
  ...props
}: IImageFallbackProps) {
  const visible = useVisible(delayMs);
  return visible ? (
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

export function ImageSkeleton(props: IImageSkeletonProps) {
  return (
    <ImageFallback {...props}>
      <Skeleton width="100%" height="100%" />
    </ImageFallback>
  );
}
