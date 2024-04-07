import { useEffect } from 'react';

import type { IImageProps } from './type';

export function ImageNull({ onLoadStart, onLoadEnd, onError }: IImageProps) {
  useEffect(() => {
    onLoadStart?.();
    setTimeout(() => {
      onError?.(new Error('image source is empty') as any);
      onLoadEnd?.();
    }, 50);
  }, [onError, onLoadEnd, onLoadStart]);
  return null;
}
