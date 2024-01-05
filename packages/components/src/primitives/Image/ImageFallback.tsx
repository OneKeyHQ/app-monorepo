import { useContext, useEffect, useState } from 'react';

import { AnimatePresence } from 'tamagui';

import { Skeleton } from '../Skeleton';
import { Stack } from '../Stack';

import { ImageContext } from './context';

import type { IImageFallbackProps, IImageSkeletonProps } from './type';

const useVisible = (delayMs: number) => {
  const [visible, setVisible] = useState(!(delayMs > 0));
  useEffect(() => {
    if (delayMs > 0) {
      setTimeout(() => {
        setVisible(true);
      }, delayMs);
    }
  }, [delayMs]);
  const { loading } = useContext(ImageContext);
  return loading && visible;
};
export function ImageFallback({
  delayMs = 0,
  children,
  ...props
}: IImageFallbackProps) {
  const visible = useVisible(delayMs);
  return (
    <AnimatePresence>
      {visible ? (
        <Stack
          position="absolute"
          width="100%"
          height="100%"
          {...props}
          animation="slow"
          exitStyle={{ opacity: 0 }}
        >
          {children}
        </Stack>
      ) : null}
    </AnimatePresence>
  );
}

export function ImageSkeleton(props: IImageSkeletonProps) {
  return (
    <ImageFallback {...props}>
      <Skeleton width="100%" height="100%" />
    </ImageFallback>
  );
}
