import { useContext } from 'react';

import { Stack } from '../Stack';

import { ImageContext } from './context';

import type { IImageLoadingProps } from './type';

export function ImageLoading({ children, ...props }: IImageLoadingProps) {
  const { loading } = useContext(ImageContext);
  return loading ? (
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
