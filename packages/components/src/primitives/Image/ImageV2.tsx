import type { ReactElement } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { Image as ExpoImage, resolveSource } from 'expo-image';
import { StyleSheet } from 'react-native';

import { usePropsAndStyle } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Skeleton } from '../Skeleton';
import { YStack } from '../Stack';

import { AnimatedExpoImage } from './AnimatedImage';
import { buildOptimizedImageSource } from './optimization';
import { isEmptyResolvedSource, useResetError } from './utils';

import type { IImageV2Props } from './type';
import type {
  ImageErrorEventData,
  ImageLoadEventData,
  ImageSource,
  ImageStyle,
} from 'expo-image';

const fullSizeStyle = {
  width: '100%' as const,
  height: '100%' as const,
};

const SHOULD_OPTIMIZE_RELATIVE_URL =
  platformEnv.isWeb || platformEnv.isWebEmbed;

export function ImageV2({
  style: defaultStyle,
  animated,
  canRetry: _canRetry = true,
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
    fallback,
    skeleton,
    onError,
    onLoad,
    onLoadEnd,
    onDisplay,
    onLoadStart,
    resizeWidth,
    ...imageProps
  } = restProps;
  const [hasError, setHasError] = useState(false);
  const rawSource = useMemo(() => {
    return (source as ImageSource) || src;
  }, [source, src]);
  const rawResolvedSource = useMemo(() => {
    return resolveSource(rawSource);
  }, [rawSource]);
  const optimizedSourceResult = useMemo(
    () =>
      buildOptimizedImageSource({
        source: rawSource,
        resolvedSource: rawResolvedSource,
        resizeWidth,
        width: [style.width, sizeProps?.width, props.width, props.w],
        height: [style.height, sizeProps?.height, props.height, props.h],
        allowRelativeUrl: SHOULD_OPTIMIZE_RELATIVE_URL,
      }),
    [
      props.h,
      props.height,
      props.w,
      props.width,
      rawResolvedSource,
      rawSource,
      resizeWidth,
      sizeProps?.height,
      sizeProps?.width,
      style.height,
      style.width,
    ],
  );
  const [rawSourceFallbackUri, setRawSourceFallbackUri] = useState<
    string | undefined
  >();
  const shouldUseRawSourceFallback =
    optimizedSourceResult.optimized &&
    Boolean(optimizedSourceResult.rawUri) &&
    rawSourceFallbackUri === optimizedSourceResult.rawUri;
  const resolvedSource = useMemo(() => {
    return shouldUseRawSourceFallback
      ? optimizedSourceResult.rawSource
      : optimizedSourceResult.source;
  }, [
    optimizedSourceResult.rawSource,
    optimizedSourceResult.source,
    shouldUseRawSourceFallback,
  ]);

  useResetError(resolvedSource, hasError, setHasError);

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
      if (
        optimizedSourceResult.optimized &&
        optimizedSourceResult.rawUri &&
        !shouldUseRawSourceFallback
      ) {
        setRawSourceFallbackUri(optimizedSourceResult.rawUri);
        return;
      }
      setHasError(true);
      onError?.(event);
    },
    [
      onError,
      optimizedSourceResult.optimized,
      optimizedSourceResult.rawUri,
      shouldUseRawSourceFallback,
    ],
  );

  const ImageComponent = useMemo(() => {
    if (animated) {
      return AnimatedExpoImage;
    }
    return ExpoImage;
  }, [animated]);

  const content = useMemo(() => {
    if (fallback && (hasError || isEmptyResolvedSource(resolvedSource))) {
      return fallback as ReactElement;
    }
    return (
      <ImageComponent
        source={resolvedSource}
        style={fullSizeStyle}
        onError={handleError}
        onLoad={handleLoad}
        onLoadEnd={handleLoadEnd}
        onDisplay={onDisplay}
        onLoadStart={onLoadStart}
        {...(imageProps as any)}
      />
    );
  }, [
    ImageComponent,
    fallback,
    handleError,
    handleLoad,
    handleLoadEnd,
    hasError,
    imageProps,
    onDisplay,
    onLoadStart,
    resolvedSource,
  ]);

  const containerStyle = useMemo(
    () => ({
      overflow: 'hidden' as const,
      display: 'flex' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      ...style,
    }),
    [style],
  );

  return (
    <YStack style={containerStyle}>
      {content}

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
