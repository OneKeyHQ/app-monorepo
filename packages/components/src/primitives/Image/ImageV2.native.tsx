import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  OneKeyImage,
  OneKeyImageCachePolicy,
  OneKeyImageContentFit,
  type OneKeyImageErrorEvent,
  type OneKeyImageLoadEvent,
  OneKeyImageLoadingStrategy,
  type OneKeyImageProps,
} from '@onekeyfe/react-native-image';
import {
  type ImageStyle,
  type ImageURISource,
  PixelRatio,
  Platform,
  Image as ReactNativeImage,
  StyleSheet,
  View,
} from 'react-native';

import { usePropsAndStyle } from '@onekeyhq/components/src/shared/tamagui';
import { ANDROID_PACKAGE_NAME } from '@onekeyhq/shared/src/config/appConfig';

import {
  buildOptimizedImageSource,
  hasCustomSourceIdentity,
} from './optimization';

import type {
  IImageCachePolicy,
  IImageContentFit,
  IImageV2Props,
} from './type';

const CACHE_POLICIES: Record<IImageCachePolicy, OneKeyImageCachePolicy> = {
  disk: OneKeyImageCachePolicy.DISK,
  memory: OneKeyImageCachePolicy.MEMORY,
  'memory-disk': OneKeyImageCachePolicy.MEMORY_DISK,
  none: OneKeyImageCachePolicy.NONE,
};

const getRandomRetryDelay = () => Math.floor(Math.random() * 3) * 1000;

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
});

function getContentFit({
  contentFit,
  resizeMode,
}: {
  contentFit?: IImageContentFit;
  resizeMode?: IImageV2Props['resizeMode'];
}) {
  if (contentFit === 'fill') {
    return OneKeyImageContentFit.FILL;
  }
  if (contentFit === 'contain') {
    return OneKeyImageContentFit.CONTAIN;
  }
  if (contentFit === 'center') {
    return OneKeyImageContentFit.CENTER;
  }
  if (contentFit === 'cover') {
    return OneKeyImageContentFit.COVER;
  }
  if (resizeMode === 'stretch') {
    return OneKeyImageContentFit.FILL;
  }
  if (resizeMode === 'contain') {
    return OneKeyImageContentFit.CONTAIN;
  }
  if (resizeMode === 'center' || resizeMode === 'none') {
    return OneKeyImageContentFit.CENTER;
  }
  return OneKeyImageContentFit.COVER;
}

function getPositiveNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function selectSourceCandidate({
  sources,
  width,
  height,
}: {
  sources: readonly ImageURISource[];
  width?: unknown;
  height?: unknown;
}) {
  if (sources.length <= 1) {
    return sources[0];
  }

  const displayWidth = getPositiveNumber(width);
  const displayHeight = getPositiveNumber(height);
  if (displayWidth && displayHeight) {
    const pixelRatio = PixelRatio.get();
    const targetArea = displayWidth * displayHeight * pixelRatio * pixelRatio;
    let bestSource: ImageURISource | undefined;
    let bestPrecision = Number.POSITIVE_INFINITY;

    sources.forEach((source) => {
      const sourceWidth = getPositiveNumber(source.width);
      const sourceHeight = getPositiveNumber(source.height);
      if (!sourceWidth || !sourceHeight) {
        return;
      }
      const sourceScale = getPositiveNumber(source.scale) ?? 1;
      const precision = Math.abs(
        1 -
          (sourceWidth * sourceHeight * sourceScale * sourceScale) / targetArea,
      );
      if (precision < bestPrecision) {
        bestPrecision = precision;
        bestSource = source;
      }
    });

    if (bestSource) {
      return bestSource;
    }
  }

  const scaledSources = sources
    .filter((source) => getPositiveNumber(source.scale))
    .toSorted((left, right) => (left.scale ?? 1) - (right.scale ?? 1));
  if (scaledSources.length > 0) {
    const pixelRatio = PixelRatio.get();
    return (
      scaledSources.find((source) => (source.scale ?? 1) >= pixelRatio) ??
      scaledSources[scaledSources.length - 1]
    );
  }

  return sources[0];
}

function normalizeSource(
  source: IImageV2Props['source'] | undefined,
  width?: unknown,
  height?: unknown,
): ImageURISource | null {
  if (typeof source === 'string') {
    return { uri: source.trim() };
  }
  const candidate = Array.isArray(source)
    ? selectSourceCandidate({ sources: source, width, height })
    : source;
  if (typeof candidate === 'number') {
    const resolved = ReactNativeImage.resolveAssetSource(candidate);
    if (
      Platform.OS === 'android' &&
      resolved?.uri &&
      !resolved.uri.includes(':')
    ) {
      return {
        ...resolved,
        // Release bundles resolve require() images to a bare drawable name.
        uri: `android.resource://${ANDROID_PACKAGE_NAME}/drawable/${resolved.uri}`,
      };
    }
    return resolved ?? null;
  }
  return (candidate as ImageURISource | undefined) ?? null;
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
    onLoadStart,
    onDisplay,
    autoplay,
    resizeMode,
    contentFit,
    cachePolicy,
    recyclingKey,
    resizeWidth,
    retryTimes = 1,
    canRetry = true,
    blurRadius: _blurRadius,
    capInsets: _capInsets,
    defaultSource: _defaultSource,
    fadeDuration: _fadeDuration,
    loadingIndicatorSource: _loadingIndicatorSource,
    onPartialLoad: _onPartialLoad,
    progressiveRenderingEnabled: _progressiveRenderingEnabled,
    resizeMethod: _resizeMethod,
    srcSet: _srcSet,
    tintColor: _tintColor,
    crossOrigin: _crossOrigin,
    referrerPolicy: _referrerPolicy,
    ...viewProps
  } = restProps;

  const rawSource = source ?? src;
  const normalizedSource = useMemo(
    () => normalizeSource(rawSource, style.width, style.height),
    [rawSource, style.height, style.width],
  );
  const optimizedSourceResult = useMemo(
    () =>
      buildOptimizedImageSource({
        source: rawSource,
        resolvedSource: normalizedSource,
        resizeWidth,
        width: [style.width, sizeProps?.width, props.width, props.w],
        height: [style.height, sizeProps?.height, props.height, props.h],
      }),
    [
      normalizedSource,
      props.h,
      props.height,
      props.w,
      props.width,
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
  const activeSource = shouldUseRawSourceFallback
    ? optimizedSourceResult.rawSource
    : optimizedSourceResult.source;
  const [retryNonce, setRetryNonce] = useState(0);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryLimit = Number.isFinite(retryTimes)
    ? Math.max(0, Math.floor(retryTimes))
    : 1;
  const activeSourceIdentity = `${activeSource?.uri ?? ''}|${JSON.stringify(
    activeSource?.headers ?? {},
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
  }, [activeSourceIdentity, clearRetryTimer, retryLimit]);
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
  const effectiveRecyclingKey =
    retryNonce === 0
      ? recyclingKey
      : `${recyclingKey ?? activeSource?.uri ?? 'image'}:retry:${retryNonce}`;
  const placeholderOverlay = useMemo(
    () =>
      placeholder === null || placeholder === undefined ? undefined : (
        <View pointerEvents="none" style={styles.overlay}>
          {placeholder}
        </View>
      ),
    [placeholder],
  );
  const fallbackOverlay = useMemo(
    () =>
      fallback === null || fallback === undefined ? undefined : (
        <View pointerEvents="none" style={styles.overlay}>
          {fallback}
        </View>
      ),
    [fallback],
  );
  const handleLoad = useCallback(
    (event: OneKeyImageLoadEvent) => {
      onLoad?.({
        cacheType: event.cacheType,
        source: event.source,
      });
    },
    [onLoad],
  );
  const handleError = useCallback(
    (event: OneKeyImageErrorEvent) => {
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
      onError?.(event);
    },
    [
      onError,
      optimizedSourceResult.optimized,
      optimizedSourceResult.rawUri,
      scheduleRetry,
      shouldUseRawSourceFallback,
    ],
  );

  return (
    <OneKeyImage
      {...(viewProps as OneKeyImageProps)}
      source={activeSource ?? undefined}
      style={style}
      placeholder={placeholderOverlay}
      fallback={fallbackOverlay}
      contentFit={getContentFit({ contentFit, resizeMode })}
      cachePolicy={cachePolicy ? CACHE_POLICIES[cachePolicy] : undefined}
      recyclingKey={effectiveRecyclingKey}
      autoplay={autoplay}
      optimizeTos={
        !hasCustomSourceIdentity(rawSource) &&
        !optimizedSourceResult.optimized &&
        !shouldUseRawSourceFallback
      }
      loadingStrategy={OneKeyImageLoadingStrategy.SKELETON}
      onError={handleError}
      onLoad={onLoad ? handleLoad : undefined}
      onLoadEnd={onLoadEnd}
      onLoadStart={onLoadStart}
      onDisplay={onDisplay}
    />
  );
}
