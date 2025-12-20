import { useContext } from 'react';

import { Stack } from '../Stack';

import { ImageContext } from './context';
import { useVisible } from './useVisible';

import type { IImageLoadingProps } from './type';

export function ImageLoading({
  children,
  delayMs = 0,
  ...props
}: IImageLoadingProps) {
  const { loading } = useContext(ImageContext);
  const visible = useVisible(delayMs);

  return loading && !visible ? (
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
