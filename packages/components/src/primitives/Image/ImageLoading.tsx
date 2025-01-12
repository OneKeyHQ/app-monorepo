import { useContext, useEffect, useState } from 'react';

import { Stack } from '../Stack';

import { ImageContext } from './context';

import type { IImageLoadingProps } from './type';

export function ImageLoading({
  children,
  delayMs = 0,
  ...props
}: IImageLoadingProps) {
  const { loading } = useContext(ImageContext);
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

  return loading && visible ? (
    <Stack
      bg="$bgApp"
      position="absolute"
      width="100%"
      height="100%"
      {...props}
    >
      {children}
    </Stack>
  ) : null;
}
