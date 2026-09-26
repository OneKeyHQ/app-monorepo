import type { ComponentType, ReactElement } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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
import {
  isPreloadedImageUri,
  markPreloadedImageUri,
} from './preloadedImageUris';
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
  const setImageContainerRef = useCallback((element: unknown) => {
    imageContainerRef.current = element as HTMLElement | null;
  }, []);

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
    round: _round,
    cachePolicy: _cachePolicy,
    autoplay: _autoplay,
    loadingStrategy = 'none',
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

  // react-native-web loads images by URI and ignores `source.headers`, so the
  // URI alone identifies the web request.
  const resolvedSourceIdentity = resolvedSource?.uri ?? '';
  useResetError(resolvedSourceIdentity, hasError, setHasError);

  // A prefetched URI is in react-native-web's own cache, so passing it at
  // mount lets the image start LOADED and paint in the first commit. Holding
  // it back for the IntersectionObserver instead costs two blank frames on
  // every mount, which is visible as a flash in lists that remount their rows.
  const [shouldLoadImage, setShouldLoadImage] = useState(
    () => !platformEnv.isWeb || isPreloadedImageUri(resolvedSourceIdentity),
  );
  if (!shouldLoadImage && isPreloadedImageUri(resolvedSourceIdentity)) {
    // A deferred image whose source was swapped to (or has since been)
    // prefetched can paint now instead of waiting to intersect the viewport.
    setShouldLoadImage(true);
  }

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

  // The IntersectionObserver above only reports after the browser has painted
  // the mount, so an image that is already inside the viewport still spends a
  // frame or two blank (visible as icons popping in when a list replaces all
  // of its rows). Measure once in the layout phase instead: a laid-out element
  // within the viewport (plus the same margin the observer uses) gets its
  // source in this very commit. Off-screen or not-yet-laid-out elements keep
  // waiting for the observer.
  useLayoutEffect(() => {
    if (!platformEnv.isWeb || shouldLoadImage) {
      return;
    }
    const element = imageContainerRef.current;
    if (!element || typeof element.getBoundingClientRect !== 'function') {
      return;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return;
    }
    const margin = 200;
    const viewportWidth =
      globalThis.innerWidth || document.documentElement?.clientWidth || 0;
    const viewportHeight =
      globalThis.innerHeight || document.documentElement?.clientHeight || 0;
    if (
      rect.bottom >= -margin &&
      rect.right >= -margin &&
      rect.top <= viewportHeight + margin &&
      rect.left <= viewportWidth + margin
    ) {
      setShouldLoadImage(true);
    }
  }, [shouldLoadImage]);

  // react-native-web aborts a superseded request from a passive effect, and it
  // cannot abort the `decode()` that follows a completed load at all, so the
  // previous source's callbacks can still arrive after a swap. Tracking the
  // displayed URI in a layout effect keeps that marker on committed renders
  // only, so a discarded concurrent render cannot silence a live callback.
  const displayedSourceIdentityRef = useRef(resolvedSourceIdentity);
  useLayoutEffect(() => {
    displayedSourceIdentityRef.current = resolvedSourceIdentity;
  }, [resolvedSourceIdentity]);

  const retryLimit = Number.isFinite(retryTimes)
    ? Math.max(0, Math.floor(retryTimes))
    : 1;
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
      if (resolvedSourceIdentity !== displayedSourceIdentityRef.current) {
        return;
      }
      clearPlaceholderTimer();
      setHasError(false);
      setIsImageLoaded(true);
      setIsPlaceholderVisible(false);
      // react-native-web only seeds its ImageUriCache from `prefetch`; a
      // displayed image never enters it, so every later mount of the same URI
      // (a list that remounts its rows) starts IDLE and paints one load later.
      // Prefetching the URI we just displayed resolves from the browser cache
      // and lets the next mount start LOADED, painting in its first commit.
      // Every DOM runtime (web, desktop, extension) renders through
      // react-native-web, so this is not limited to `isWeb`.
      if (platformEnv.isRuntimeBrowser && resolvedSourceIdentity) {
        const loadedUri = resolvedSourceIdentity;
        if (!isPreloadedImageUri(loadedUri)) {
          void ReactNativeImage.prefetch(loadedUri).then(
            () => markPreloadedImageUri(loadedUri),
            () => undefined,
          );
        }
      }
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
    [
      clearPlaceholderTimer,
      onDisplay,
      onLoad,
      resolvedSource?.uri,
      resolvedSourceIdentity,
    ],
  );

  const handleLoadEnd = useCallback(() => {
    if (resolvedSourceIdentity !== displayedSourceIdentityRef.current) {
      return;
    }
    clearPlaceholderTimer();
    setIsPlaceholderVisible(false);
    onLoadEnd?.();
  }, [clearPlaceholderTimer, onLoadEnd, resolvedSourceIdentity]);

  const handleError = useCallback(
    (event: ImageErrorEvent) => {
      if (resolvedSourceIdentity !== displayedSourceIdentityRef.current) {
        return;
      }
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
      resolvedSourceIdentity,
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
    // The key deliberately excludes the source URI. react-native-web paints
    // nothing until its own load state leaves IDLE, so remounting on every URI
    // change costs an extra blank frame even when the new image is already
    // cached; updating `source` in place keeps the previous LOADED state and
    // lets a cached image paint in the same commit.
    return (
      <ImageComponent
        key={`${recyclingKey ?? 'image'}:${retryNonce}`}
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
