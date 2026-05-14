import { Stack } from '../Stack';

import type { IImageFallbackProps } from './type';

export function ImageFallback({ children, ...props }: IImageFallbackProps) {
  return (
    <Stack bg="$bgApp" {...props}>
      {children}
    </Stack>
  );
}
