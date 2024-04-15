import { useEffect } from 'react';

import type { IImageProps } from './type';

// 1. Prevent crash on Android when image source is empty;
// 2. Regardless of whether there is a picture, the events need to be triggered.
export function ImageNull({ onLoadStart, onLoadEnd, onError }: IImageProps) {
  useEffect(() => {
    onLoadStart?.();
    setTimeout(() => {
      onError?.(new Error('image source is empty') as any);
      onLoadEnd?.();
    }, 0);
  }, [onError, onLoadEnd, onLoadStart]);
  return null;
}
