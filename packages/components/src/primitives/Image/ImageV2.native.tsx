import { useCallback, useMemo } from 'react';

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
  type ImageSourcePropType,
  type ImageStyle,
  Platform,
  Image as ReactNativeImage,
  StyleSheet,
  View,
} from 'react-native';

import { usePropsAndStyle } from '@onekeyhq/components/src/shared/tamagui';

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
  if (contentFit === 'fill' || resizeMode === 'stretch') {
    return OneKeyImageContentFit.FILL;
  }
  if (contentFit === 'contain' || resizeMode === 'contain') {
    return OneKeyImageContentFit.CONTAIN;
  }
  if (
    contentFit === 'center' ||
    resizeMode === 'center' ||
    resizeMode === 'none'
  ) {
    return OneKeyImageContentFit.CENTER;
  }
  return OneKeyImageContentFit.COVER;
}

function normalizeSource(
  source: IImageV2Props['source'] | undefined,
): OneKeyImageProps['source'] {
  if (typeof source === 'string') {
    return { uri: source.trim() };
  }
  const candidate = Array.isArray(source) ? source[0] : source;
  if (typeof candidate === 'number') {
    const resolved = ReactNativeImage.resolveAssetSource(candidate);
    if (
      Platform.OS === 'android' &&
      resolved?.uri &&
      !resolved.uri.includes(':')
    ) {
      return {
        ...resolved,
        uri: `android.resource://so.onekey.app.wallet/drawable/${resolved.uri}`,
      };
    }
    return resolved;
  }
  return candidate as Exclude<ImageSourcePropType, ImageSourcePropType[]>;
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
    resizeWidth: _resizeWidth,
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

  const normalizedSource = useMemo(
    () => normalizeSource(source ?? src),
    [source, src],
  );
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
      onError?.(event);
    },
    [onError],
  );

  return (
    <OneKeyImage
      {...(viewProps as OneKeyImageProps)}
      source={normalizedSource}
      style={style}
      placeholder={placeholderOverlay}
      fallback={fallbackOverlay}
      contentFit={getContentFit({ contentFit, resizeMode })}
      cachePolicy={cachePolicy ? CACHE_POLICIES[cachePolicy] : undefined}
      recyclingKey={recyclingKey}
      autoplay={autoplay}
      loadingStrategy={OneKeyImageLoadingStrategy.SKELETON}
      onError={onError ? handleError : undefined}
      onLoad={onLoad ? handleLoad : undefined}
      onLoadEnd={onLoadEnd}
      onLoadStart={onLoadStart}
      onDisplay={onDisplay}
    />
  );
}
