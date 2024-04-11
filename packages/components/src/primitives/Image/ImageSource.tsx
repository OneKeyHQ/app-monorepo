import { useCallback, useContext, useRef, useState } from 'react';

import { usePropsAndStyle } from '@tamagui/core';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { ImageContext } from './context';
import { useImageComponent, useSource } from './hooks';
import { preloadImage } from './ImageNet';

import type { IImageSourceProps } from './type';
import type { ImageStyle, ImageURISource, StyleProp } from 'react-native';

const MAX_TIMES = 5;
const retryFetchImage = async (
  imageSource: { uri?: string },
  onLoadSuccess: () => void,
  times = 0,
) => {
  if (times > MAX_TIMES) {
    return;
  }
  try {
    await preloadImage(imageSource);
    onLoadSuccess();
  } catch (error) {
    setTimeout(() => {
      void retryFetchImage(imageSource, onLoadSuccess, times + 1);
    }, timerUtils.getTimeDurationMs({ seconds: 10 }) * Math.random());
  }
};

export function ImageSource({
  source,
  src,
  delayMs = 0,
  ...props
}: IImageSourceProps) {
  const hasError = useRef(false);
  const startTime = useRef(Date.now());
  const delayTimer = useRef<ReturnType<typeof setTimeout>>();
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });

  const imageSource = useSource(source, src);
  const ImageComponent = useImageComponent(imageSource);

  const { setLoading, setLoadedSuccessfully } = useContext(ImageContext);

  const handleLoadStart = useCallback(() => {
    clearTimeout(delayTimer.current);
    hasError.current = false;
    setLoading?.(true);
  }, [setLoading]);

  const handleLoadEnd = useCallback(() => {
    const diff = Date.now() - startTime.current;
    delayTimer.current = setTimeout(
      () => {
        setLoading?.(false);
        setLoadedSuccessfully?.(!hasError.current);
      },
      diff > delayMs ? 0 : delayMs - diff,
    );
  }, [delayMs, setLoadedSuccessfully, setLoading]);

  const [isVisible, setIsVisible] = useState(true);
  const isRetry = useRef(false);
  const handleError = useCallback(() => {
    hasError.current = true;
    // Android specify:
    // After triggering the onerror event, the onLoadEnd event will not be triggered again.
    if (platformEnv.isNativeAndroid) {
      handleLoadEnd();
    }
    if (isRetry.current) {
      return;
    }
    isRetry.current = true;
    if (imageSource && (imageSource as ImageURISource).uri) {
      setTimeout(() => {
        void retryFetchImage(imageSource as ImageURISource, () => {
          // reload image when loaded successfully
          setIsVisible(false);
          setTimeout(() => {
            setIsVisible(true);
          }, 50);
        });
      }, 0);
    }
  }, [handleLoadEnd, imageSource]);

  style.width = style.width ? (style.width as number) : '100%';
  style.height = style.height ? (style.height as number) : '100%';

  return isVisible ? (
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
  ) : null;
}
