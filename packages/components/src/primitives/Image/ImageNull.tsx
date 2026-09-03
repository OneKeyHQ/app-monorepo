import { useEffect } from 'react';

import type { IImageProps } from './type';

// 1. Prevent crash on Android when image source is empty;
// 2. Regardless of whether there is a picture, the events need to be triggered.
export function ImageNull({ onLoadStart, onLoadEnd, onError }: IImageProps) {
  useEffect(() => {
    onLoadStart?.();
    onError?.({ error: 'image source is empty' });
    onLoadEnd?.();
  }, [onError, onLoadEnd, onLoadStart]);
  return null;
}
