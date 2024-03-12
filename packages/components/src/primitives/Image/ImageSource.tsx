import { useCallback, useContext, useRef } from 'react';

import { usePropsAndStyle } from '@tamagui/core';
import { Image as NativeImage } from 'react-native';

import { ImageContext } from './context';
import { useSource } from './hooks';

import type { IImageSourceProps } from './type';
import type { ImageStyle, StyleProp } from 'react-native';

export function ImageSource({
  source,
  src,
  delayMs,
  ...props
}: IImageSourceProps) {
  const hasError = useRef(false);
  const startTime = useRef(Date.now());
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });

  const { setLoading } = useContext(ImageContext);

  const handleLoadStart = useCallback(() => {
    setLoading?.(true);
  }, [setLoading]);

  const handleError = useCallback(() => {
    hasError.current = true;
  }, []);

  const handleLoadEnd = useCallback(() => {
    if (hasError.current) {
      return;
    }
    if (delayMs) {
      const diff = Date.now() - startTime.current;
      setTimeout(
        () => {
          setLoading?.(false);
        },
        diff > delayMs ? 0 : delayMs - diff,
      );
    } else {
      setLoading?.(false);
    }
  }, [delayMs, setLoading]);

  const imageSource = useSource(source, src);
  if (!imageSource) {
    return null;
  }
  style.width = style.width ? (style.width as number) : '100%';
  style.height = style.height ? (style.height as number) : '100%';
  return (
    <NativeImage
      source={imageSource}
      {...restProps}
      borderRadius={style.borderRadius as number}
      width={undefined}
      height={undefined}
      onError={handleError}
      onLoadStart={handleLoadStart}
      onLoadEnd={handleLoadEnd}
      style={style as StyleProp<ImageStyle>}
    />
  );
}
