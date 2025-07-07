import { useCallback, useContext, useRef, useState } from 'react';

import { usePropsAndStyle } from '@tamagui/core';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { ImageContext } from './context';
import { useImageComponent, useSource } from './hooks';
import { preloadImage } from './preload';

import type { IImageSourceProps } from './type';
import type { Image as ExpoImage } from 'expo-image';
import type { ImageStyle, ImageURISource, StyleProp } from 'react-native';

const buildDelayMs = () =>
  timerUtils.getTimeDurationMs({ seconds: 5 }) +
  timerUtils.getTimeDurationMs({ seconds: 40 }) * Math.random();

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
    }, buildDelayMs());
  }
};

/**
 * @deprecated Use Image.V2 instead. example: packages/kit/src/views/Developer/pages/Gallery/Components/stories/Image.tsx
 */
export function ImageSource({
  source,
  src,
  delayMs = 0,
  ...props
}: IImageSourceProps) {
  const hasError = useRef(false);
  const startTime = useRef(Date.now());
  const delayTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });

  const imageSource = useSource(source, src);
  const previousImageSource = useRef<typeof imageSource>(undefined);
  const ImageComponent = useImageComponent(
    imageSource,
  ) as unknown as typeof ExpoImage;

  const { setLoading, setLoadedSuccessfully } = useContext(ImageContext);

  const handleLoadStart = useCallback(() => {
    // avoid re-render on FastImage in App
    if (previousImageSource.current === imageSource) {
      return;
    }
    clearTimeout(delayTimer.current);
    hasError.current = false;
    setLoading?.(true);
    previousImageSource.current = imageSource;
  }, [imageSource, setLoading]);

  const handleLoadEnd = useCallback(() => {
    const diff = Date.now() - startTime.current;
    delayTimer.current = setTimeout(
      () => {
        setLoading?.(false);
        setLoadedSuccessfully?.(!hasError.current);
      },
      diff > delayMs ? 0 : Math.max(delayMs - diff, 0),
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
    if (
      imageSource &&
      (imageSource as ImageURISource).uri &&
      (imageSource as ImageURISource).uri?.startsWith('https:')
    ) {
      setTimeout(() => {
        void retryFetchImage(imageSource as ImageURISource, () => {
          // reload image when loaded successfully
          setIsVisible(false);
          setTimeout(() => {
            setIsVisible(true);
          }, 50);
        });
      }, buildDelayMs());
    }
  }, [handleLoadEnd, imageSource]);

  style.width = style.width ? (style.width as number) : '100%';
  style.height = style.height ? (style.height as number) : '100%';

  return isVisible ? (
    <ImageComponent
      // Browser-level image lazy loading for the web
      // https://developer.mozilla.org/en-US/docs/Web/Performance/Lazy_loading
      // @ts-expect-error
      loading="lazy"
      source={imageSource}
      {...restProps}
      onError={handleError}
      onLoadStart={handleLoadStart}
      onLoadEnd={handleLoadEnd}
      style={style as StyleProp<ImageStyle>}
    />
  ) : null;
}
