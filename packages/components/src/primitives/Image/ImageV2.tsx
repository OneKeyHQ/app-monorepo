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

import {
  usePropsAndStyle,
  useTheme,
} from '@onekeyhq/components/src/shared/tamagui';
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
const IMAGE_LOADING_DELAY_MS = 100;
const IMAGE_FADE_DURATION_MS = 140;

const getRandomRetryDelay = () => Math.floor(Math.random() * 3) * 1000;

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
  const theme = useTheme();
  const imageContainerRef = useRef<HTMLElement | null>(null);
  const [shouldLoadImage, setShouldLoadImage] = useState(!platformEnv.isWeb);
  const setImageContainerRef = useCallback((element: unknown) => {
    imageContainerRef.current = element as HTMLElement | null;
  }, []);

  useEffect(() => {
    if (!platformEnv.isWeb || shouldLoadImage) {
      return undefined;
    }

    const element = imageContainerRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setShouldLoadImage(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoadImage(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '200px',
        // Expand nested ScrollView clipping bounds as well as the viewport.
        scrollMargin: '200px',
      } as IntersectionObserverInit & { scrollMargin: string },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [shouldLoadImage]);

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
    retryTimes = 1,
    canRetry = true,
    blurRadius: _blurRadius,
    defaultSource: _defaultSource,
    tintColor: _tintColor,
    cachePolicy: _cachePolicy,
    autoplay: _autoplay,
    loadingStrategy = 'static',
    ...imageProps
  } = restProps;
  const [hasError, setHasError] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPlaceholderVisible, setIsPlaceholderVisible] = useState(false);
  const placeholderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const loadStartedAtRef = useRef(0);
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

  const retryLimit = Number.isFinite(retryTimes)
    ? Math.max(0, Math.floor(retryTimes))
    : 1;
  const resolvedSourceIdentity = `${resolvedSource?.uri ?? ''}|${JSON.stringify(
    resolvedSource?.headers ?? {},
  )}`;
  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);
  useEffect(() => {
    retryCountRef.current = 0;
    clearRetryTimer();
  }, [clearRetryTimer, resolvedSourceIdentity, retryLimit]);
  useEffect(() => clearRetryTimer, [clearRetryTimer]);
  const scheduleRetry = useCallback(() => {
    if (!canRetry || retryCountRef.current >= retryLimit) {
      return false;
    }
    retryCountRef.current += 1;
    clearRetryTimer();
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      setRetryNonce((value) => value + 1);
    }, getRandomRetryDelay());
    return true;
  }, [canRetry, clearRetryTimer, retryLimit]);

  const clearPlaceholderTimer = useCallback(() => {
    if (placeholderTimerRef.current) {
      clearTimeout(placeholderTimerRef.current);
      placeholderTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearPlaceholderTimer, [clearPlaceholderTimer]);

  const handleLoadStart = useCallback(() => {
    clearPlaceholderTimer();
    setIsImageLoaded(false);
    loadStartedAtRef.current =
      typeof performance === 'undefined' ? Date.now() : performance.now();
    setIsPlaceholderVisible(false);
    if (
      (placeholder !== null && placeholder !== undefined) ||
      loadingStrategy === 'skeleton'
    ) {
      placeholderTimerRef.current = setTimeout(() => {
        setIsPlaceholderVisible(true);
      }, IMAGE_LOADING_DELAY_MS);
    }
    onLoadStart?.();
  }, [clearPlaceholderTimer, loadingStrategy, onLoadStart, placeholder]);

  const handleLoad = useCallback(
    (event: ImageLoadEvent) => {
      clearPlaceholderTimer();
      setHasError(false);
      setIsImageLoaded(true);
      setIsPlaceholderVisible(false);
      const nativeEvent = event.nativeEvent as unknown as {
        source?: { height?: number; uri?: string; width?: number };
        target?: {
          currentSrc?: string;
          naturalHeight?: number;
          naturalWidth?: number;
        };
      };
      const height =
        nativeEvent.source?.height ?? nativeEvent.target?.naturalHeight ?? 0;
      const uri =
        nativeEvent.source?.uri ??
        nativeEvent.target?.currentSrc ??
        resolvedSource?.uri ??
        '';
      const width =
        nativeEvent.source?.width ?? nativeEvent.target?.naturalWidth ?? 0;
      const loadEvent: IImageLoadEventData = {
        cacheType: 'none',
        source: {
          url: uri,
          width,
          height,
        },
      };
      const now =
        typeof performance === 'undefined' ? Date.now() : performance.now();
      const reduceMotion =
        typeof globalThis.matchMedia === 'function' &&
        globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const imageElement = event.currentTarget as unknown as HTMLElement;
      if (
        !reduceMotion &&
        loadStartedAtRef.current > 0 &&
        now - loadStartedAtRef.current >= IMAGE_LOADING_DELAY_MS &&
        typeof imageElement?.animate === 'function'
      ) {
        imageElement.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: IMAGE_FADE_DURATION_MS,
          easing: 'ease-out',
        });
      }
      onLoad?.(loadEvent);
      onDisplay?.();
    },
    [clearPlaceholderTimer, onDisplay, onLoad, resolvedSource?.uri],
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
      if (scheduleRetry()) {
        return;
      }
      clearPlaceholderTimer();
      setIsImageLoaded(false);
      setIsPlaceholderVisible(false);
      setHasError(true);
      onError?.({ error: String(event.nativeEvent.error) });
    },
    [
      clearPlaceholderTimer,
      onError,
      optimizedSourceResult.optimized,
      optimizedSourceResult.rawUri,
      scheduleRetry,
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
    if (hasError || isEmptyResolvedSource(resolvedSource)) {
      return null;
    }
    return (
      <ImageComponent
        key={`${recyclingKey ?? resolvedSource?.uri ?? 'image'}:${retryNonce}`}
        source={
          shouldLoadImage ? (resolvedSource as ImageSourcePropType) : undefined
        }
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
    retryNonce,
    resizeMode,
    resolvedSource,
    shouldLoadImage,
  ]);

  const containerStyle = useMemo(
    () => ({
      overflow: 'hidden' as const,
      display: 'flex' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor:
        loadingStrategy === 'none' || isImageLoaded
          ? 'transparent'
          : theme.bgStrong.val,
      ...style,
    }),
    [isImageLoaded, loadingStrategy, style, theme.bgStrong.val],
  );

  return (
    <YStack ref={setImageContainerRef} style={containerStyle}>
      {content}
      {isPlaceholderVisible &&
      (placeholder !== null && placeholder !== undefined
        ? true
        : loadingStrategy === 'skeleton') ? (
        <Stack position="absolute" width="100%" height="100%">
          {placeholder ?? <Skeleton width="100%" height="100%" />}
        </Stack>
      ) : null}
    </YStack>
  );
}
