import { useEffect, useState } from 'react';

import { Stack } from '../Stack';

import type { IImageLoadingProps } from './type';

// Delayed-render wrapper used as `<Image skeleton={...} />`.
// While the parent Image is loading, this stays mounted; if `delayMs > 0`
// it postpones the visual to prevent flicker for fast/cached loads.
export function ImageLoading({
  children,
  delayMs = 0,
  ...props
}: IImageLoadingProps) {
  const [visible, setVisible] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) return;
    const id = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);

  if (!visible) return null;

  return (
    <Stack
      bg="$bgApp"
      position="absolute"
      width="100%"
      height="100%"
      {...props}
    >
      {children}
    </Stack>
  );
}
