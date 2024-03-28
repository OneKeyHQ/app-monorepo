import { useContext } from 'react';

import { Stack } from '../Stack';

import { ImageContext } from './context';

import type { IImageFallbackProps } from './type';

export function ImageLoading({ children, ...props }: IImageFallbackProps) {
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
