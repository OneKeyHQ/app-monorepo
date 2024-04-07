import { useCallback, useContext, useRef } from 'react';

import { usePropsAndStyle } from '@tamagui/core';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ImageContext } from './context';
import { useImageComponent, useSource } from './hooks';

import type { IImageSourceProps } from './type';
import type { ImageStyle, StyleProp } from 'react-native';

export function ImageSource({
  source,
  src,
  delayMs = 0,
  ...props
}: IImageSourceProps) {
  const hasError = useRef(false);
  const startTime = useRef(Date.now());
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });

  const { setLoading, setLoadedSuccessfully } = useContext(ImageContext);

  const handleLoadStart = useCallback(() => {
    setLoading?.(true);
  }, [setLoading]);

  const handleLoadEnd = useCallback(() => {
    const diff = Date.now() - startTime.current;
    setTimeout(
      () => {
        setLoading?.(false);
        setLoadedSuccessfully?.(!hasError.current);
      },
      diff > delayMs ? 0 : delayMs - diff,
    );
  }, [delayMs, setLoadedSuccessfully, setLoading]);

  const handleError = useCallback(() => {
    hasError.current = true;
    // Android specify:
    // After triggering the onerror event, the onLoadEnd event will not be triggered again.
    if (platformEnv.isNativeAndroid) {
      handleLoadEnd();
    }
  }, [handleLoadEnd]);

  const imageSource = useSource(source, src);

  const ImageComponent = useImageComponent(imageSource);

  style.width = style.width ? (style.width as number) : '100%';
  style.height = style.height ? (style.height as number) : '100%';

  return (
    <ImageComponent
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
