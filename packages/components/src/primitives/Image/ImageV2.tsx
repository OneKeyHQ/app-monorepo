import { useCallback, useMemo, useRef, useState } from 'react';

import { Image as ExpoImage, resolveSource } from 'expo-image';
import { usePropsAndStyle } from 'tamagui';

import { Skeleton } from '../Skeleton';
import { YStack } from '../Stack';

import type { IImageV2Props } from './type';
import type {
  ImageErrorEventData,
  ImageLoadEventData,
  ImageSource,
  ImageStyle,
} from 'expo-image';

export function ImageV2(props: IImageV2Props) {
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
  const [restProps, style] = usePropsAndStyle(
    sizeProps ? { ...props, ...sizeProps } : props,
    {
      resolveValues: 'auto',
    },
  ) as unknown as [IImageV2Props, ImageStyle];

  const {
    source,
    src,
    fallback,
    skeleton,
    onError,
    onLoad,
    onLoadEnd,
    onDisplay,
    onLoadStart,
    ...imageProps
  } = restProps;
  const [hasError, setHasError] = useState(false);
  const resolvedSource = resolveSource((source as ImageSource) || src);

  const skeletonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const handleLoad = useCallback(
    (event: ImageLoadEventData) => {
      setHasError(false);
      onLoad?.(event);
      if (!isLoading) {
        skeletonTimerRef.current = setTimeout(() => {
          setIsLoading(true);
        }, 150);
      }
    },
    [isLoading, onLoad],
  );

  const handleLoadEnd = useCallback(() => {
    if (skeletonTimerRef.current) {
      clearTimeout(skeletonTimerRef.current);
      setIsLoading(false);
    }
    onLoadEnd?.();
  }, [onLoadEnd]);

  const handleError = useCallback(
    (event: ImageErrorEventData) => {
      setHasError(true);
      onError?.(event);
    },
    [onError],
  );

  if (hasError) {
    return fallback;
  }

  return (
    <YStack width={style.width} height={style.height}>
      <ExpoImage
        source={resolvedSource}
        style={style}
        onError={handleError}
        onLoad={handleLoad}
        onLoadEnd={handleLoadEnd}
        onDisplay={onDisplay}
        onLoadStart={onLoadStart}
        {...(imageProps as any)}
      />
      {isLoading ? (
        <Skeleton
          position="absolute"
          top={0}
          left={0}
          width={style.width}
          height={style.height}
        />
      ) : null}
    </YStack>
  );
}
