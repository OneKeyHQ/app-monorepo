import type { ComponentType, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type ImageErrorEvent,
  type ImageLoadEvent,
  type ImageSourcePropType,
  type ImageStyle,
  type ImageURISource,
  Image as ReactNativeImage,
  StyleSheet,
} from 'react-native';

import { usePropsAndStyle } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Skeleton } from '../Skeleton';
import { Stack, YStack } from '../Stack';

import { buildOptimizedImageSource } from './optimization';
import { isEmptyResolvedSource, useResetError } from './utils';

import type {
  IImageContentFit,
  IImageLoadEventData,
  IImageV2Props,
} from './type';

const fullSizeStyle = {
  width: '100%' as const,
  height: '100%' as const,
};

const SHOULD_OPTIMIZE_RELATIVE_URL =
  platformEnv.isWeb || platformEnv.isWebEmbed;

function resolveSource(
  source: IImageV2Props['source'] | undefined,
): ImageURISource | null {
  if (typeof source === 'string') {
    return { uri: source.trim() };
  }
  if (typeof source === 'number') {
    return ReactNativeImage.resolveAssetSource(source);
  }
  if (Array.isArray(source)) {
    return source[0] ?? null;
  }
  return source ?? null;
}

function getResizeMode({
  contentFit,
  resizeMode,
}: {
  contentFit?: IImageContentFit;
  resizeMode?: IImageV2Props['resizeMode'];
}): IImageV2Props['resizeMode'] {
  if (contentFit === 'fill') {
    return 'stretch';
  }
  return contentFit ?? resizeMode;
}

export function ImageV2({ style: defaultStyle, ...props }: IImageV2Props) {
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
    placeholder,
    onError,
    onLoad,
    onLoadEnd,
    onDisplay,
    onLoadStart,
    resizeWidth,
    contentFit,
    resizeMode,
    recyclingKey,
    cachePolicy: _cachePolicy,
    autoplay: _autoplay,
    ...imageProps
  } = restProps;
  const [hasError, setHasError] = useState(false);
  const [isPlaceholderVisible, setIsPlaceholderVisible] = useState(false);
  const placeholderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const rawSource = useMemo(() => source ?? src, [source, src]);
  const rawResolvedSource = useMemo(
    () => resolveSource(rawSource),
    [rawSource],
  );
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

  const clearPlaceholderTimer = useCallback(() => {
    if (placeholderTimerRef.current) {
      clearTimeout(placeholderTimerRef.current);
      placeholderTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearPlaceholderTimer, [clearPlaceholderTimer]);

  const handleLoadStart = useCallback(() => {
    clearPlaceholderTimer();
    setIsPlaceholderVisible(false);
    placeholderTimerRef.current = setTimeout(() => {
      setIsPlaceholderVisible(true);
    }, 150);
    onLoadStart?.();
  }, [clearPlaceholderTimer, onLoadStart]);

  const handleLoad = useCallback(
    (event: ImageLoadEvent) => {
      clearPlaceholderTimer();
      setHasError(false);
      setIsPlaceholderVisible(false);
      const { height, uri, width } = event.nativeEvent.source;
      const loadEvent: IImageLoadEventData = {
        cacheType: 'none',
        source: {
          url: uri,
          width,
          height,
        },
      };
      onLoad?.(loadEvent);
      onDisplay?.();
    },
    [clearPlaceholderTimer, onDisplay, onLoad],
  );

  const handleLoadEnd = useCallback(() => {
    clearPlaceholderTimer();
    setIsPlaceholderVisible(false);
    onLoadEnd?.();
  }, [clearPlaceholderTimer, onLoadEnd]);

  const handleError = useCallback(
    (event: ImageErrorEvent) => {
      if (
        optimizedSourceResult.optimized &&
        optimizedSourceResult.rawUri &&
        !shouldUseRawSourceFallback
      ) {
        setRawSourceFallbackUri(optimizedSourceResult.rawUri);
        return;
      }
      clearPlaceholderTimer();
      setIsPlaceholderVisible(false);
      setHasError(true);
      onError?.({ error: String(event.nativeEvent.error) });
    },
    [
      clearPlaceholderTimer,
      onError,
      optimizedSourceResult.optimized,
      optimizedSourceResult.rawUri,
      shouldUseRawSourceFallback,
    ],
  );

  const ImageComponent = ReactNativeImage as ComponentType<any>;

  const content = useMemo(() => {
    if (fallback && (hasError || isEmptyResolvedSource(resolvedSource))) {
      return (
        <Stack
          position="absolute"
          width="100%"
          height="100%"
          alignItems="center"
          justifyContent="center"
        >
          {fallback as ReactElement}
        </Stack>
      );
    }
    return (
      <ImageComponent
        key={recyclingKey}
        source={resolvedSource as ImageSourcePropType}
        style={fullSizeStyle}
        resizeMode={getResizeMode({ contentFit, resizeMode })}
        onError={handleError}
        onLoad={handleLoad}
        onLoadEnd={handleLoadEnd}
        onLoadStart={handleLoadStart}
        {...(imageProps as any)}
      />
    );
  }, [
    ImageComponent,
    contentFit,
    fallback,
    handleError,
    handleLoad,
    handleLoadEnd,
    handleLoadStart,
    hasError,
    imageProps,
    recyclingKey,
    resizeMode,
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
      {isPlaceholderVisible ? (
        <Stack position="absolute" width="100%" height="100%">
          {placeholder ?? <Skeleton width="100%" height="100%" />}
        </Stack>
      ) : null}
    </YStack>
  );
}
