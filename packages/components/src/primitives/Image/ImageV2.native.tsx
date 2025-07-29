import { useCallback, useMemo, useRef, useState } from 'react';

import { Image as ExpoImage } from 'expo-image';
import { StyleSheet } from 'react-native';
import { usePropsAndStyle } from 'tamagui';

import { Skeleton } from '../Skeleton';
import { Stack } from '../Stack';

import { AnimatedExpoImage } from './AnimatedImage';
import { useImage } from './useImage';
import { isEmptyResolvedSource, useResetError } from './utils';

import type { IImageV2Props } from './type';
import type { ImageErrorEventData, ImageSource, ImageStyle } from 'expo-image';

const getRandomRetryTimes = () => {
  return Math.floor(Math.random() * 3) * 1000;
};

export function ImageV2({
  style: defaultStyle,
  animated,
  ...props
}: IImageV2Props) {
  const sizeProps = useMemo(() => {
    // eslint-disable-next-line react/destructuring-assignment
    if (props?.size) {
      // eslint-disable-next-line react/destructuring-assignment
      const imageHeight = props?.height || props?.h || props?.size;
      // eslint-disable-next-line react/destructuring-assignment
      const imageWidth = props?.width || props?.w || props?.size;
      return {
        height: imageHeight,
        width: imageWidth,
      };
    }
    return undefined;
  }, [props?.size, props?.height, props?.h, props?.width, props?.w]);
  const [restProps, restStyle] = usePropsAndStyle(
    sizeProps ? { ...props, ...sizeProps } : props,
    {
      resolveValues: 'auto',
    },
  ) as unknown as [IImageV2Props, ImageStyle];

  const style = useMemo(() => {
    return defaultStyle
      ? (StyleSheet.flatten([defaultStyle, restStyle]) as typeof restStyle)
      : restStyle;
  }, [defaultStyle, restStyle]);
  const {
    source,
    src,
    retryTimes: defaultRetryTimes,
    onError,
    fallback,
    skeleton,
    onLoad,
    onLoadEnd,
    onLoadStart,
    onDisplay,
    ...imageProps
  } = restProps;
  const retryTimesLimit = useRef<number>(defaultRetryTimes || 1);
  const retryTimes = useRef<number>(0);

  const [hasError, setHasError] = useState(false);
  const { image, reFetchImage } = useImage((source as ImageSource) || src, {
    onError(error, retry) {
      console.error('Loading failed:', error.message);
      if (retryTimes.current < retryTimesLimit.current) {
        retryTimes.current += 1;
        setTimeout(() => {
          retry();
        }, getRandomRetryTimes());
      } else {
        setHasError(true);
      }
    },
  });

  const onResetError = useCallback((error: boolean) => {
    setHasError(error);
    retryTimes.current = 0;
  }, []);

  useResetError(image, hasError, onResetError);

  const handleError = useCallback(
    (event: ImageErrorEventData) => {
      reFetchImage();
      onError?.(event);
    },
    [onError, reFetchImage],
  );

  if (!image) {
    if (hasError || isEmptyResolvedSource(source as ImageSource | null)) {
      return (
        <Stack
          style={{
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...style,
          }}
        >
          {fallback}
        </Stack>
      );
    }
    return skeleton || <Skeleton width={style.width} height={style.height} />;
  }

  if (animated) {
    return (
      <AnimatedExpoImage
        source={image}
        style={style}
        onError={handleError}
        onLoad={onLoad}
        onLoadEnd={onLoadEnd}
        onDisplay={onDisplay}
        onLoadStart={onLoadStart}
        {...(imageProps as any)}
      />
    );
  }

  return (
    <ExpoImage
      source={image}
      style={style}
      onError={handleError}
      onLoad={onLoad}
      onLoadEnd={onLoadEnd}
      onDisplay={onDisplay}
      onLoadStart={onLoadStart}
      {...(imageProps as any)}
    />
  );
}
