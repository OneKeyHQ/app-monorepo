import { useCallback, useMemo, useState } from 'react';

import { Image as ExpoImage, resolveSource } from 'expo-image';
import { StyleSheet } from 'react-native';

import { usePropsAndStyle } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Skeleton } from '../Skeleton';
import { Stack } from '../Stack';

import { DEFAULT_CACHE_POLICY } from './cachePolicy';
import { isEmptyResolvedSource } from './utils';

import type { IImageV2Props } from './type';
import type {
  ImageErrorEventData,
  ImageLoadEventData,
  ImageSource,
  ImageStyle,
} from 'expo-image';

// Disable GIF autoplay by default on Android to prevent OOM in long lists.
const DEFAULT_AUTOPLAY = !platformEnv.isNativeAndroid;

const CONTAINER_STYLE: ImageStyle = {
  overflow: 'hidden',
  alignItems: 'center',
  justifyContent: 'center',
};

const FULL_SIZE: ImageStyle = { width: '100%', height: '100%' };

export function Image(props: IImageV2Props) {
  const { style: outerStyle, size, ...inputProps } = props;

  const tamaguiInput = size
    ? {
        ...inputProps,
        height: inputProps.height ?? inputProps.h ?? size,
        width: inputProps.width ?? inputProps.w ?? size,
      }
    : inputProps;

  const [resolvedProps, restStyle] = usePropsAndStyle(tamaguiInput, {
    resolveValues: 'auto',
  }) as unknown as [IImageV2Props, ImageStyle];

  const {
    source,
    src,
    fallback,
    skeleton,
    autoplay,
    onLoad,
    onLoadEnd,
    onLoadStart,
    onDisplay,
    onError,
    ...imageProps
  } = resolvedProps;

  const containerStyle = useMemo(
    () =>
      outerStyle
        ? {
            ...CONTAINER_STYLE,
            ...(StyleSheet.flatten([outerStyle, restStyle]) as ImageStyle),
          }
        : { ...CONTAINER_STYLE, ...restStyle },
    [outerStyle, restStyle],
  );

  // Memoize by URI string identity (not source object ref) so that callers
  // passing inline `{ uri }` objects don't defeat expo-image's
  // PureComponent shallow compare. Without this, every parent re-render
  // produces a new source object ref → PureComponent diff fails → expo-image
  // re-renders its whole tree (the browser HTTP cache still hits, but React
  // reconciler work is wasted).
  let sourceKey = '';
  if (typeof source === 'number') {
    sourceKey = `__asset:${source}`;
  } else if (typeof source === 'string') {
    sourceKey = source;
  } else if (source && typeof source === 'object' && 'uri' in source) {
    sourceKey = (source as { uri?: string }).uri ?? '';
  } else if (src) {
    sourceKey = src;
  }

  const resolvedSource = useMemo(
    () => resolveSource((source ?? src) as ImageSource | string | number),
    // Stable on URI string; skip re-resolving when callers pass inline objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceKey],
  );

  // State-during-render: reset transient state when source actually changes,
  // avoiding an extra effect pass.
  const [prevSourceKey, setPrevSourceKey] = useState(sourceKey);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  if (sourceKey !== prevSourceKey) {
    setPrevSourceKey(sourceKey);
    setHasError(false);
    setIsLoaded(false);
  }

  const handleLoad = useCallback(
    (event: ImageLoadEventData) => {
      setIsLoaded(true);
      onLoad?.(event);
    },
    [onLoad],
  );

  const handleError = useCallback(
    (event: ImageErrorEventData) => {
      setHasError(true);
      onError?.(event);
    },
    [onError],
  );

  if (isEmptyResolvedSource(resolvedSource) || hasError) {
    return <Stack style={containerStyle}>{fallback ?? null}</Stack>;
  }

  const skeletonNode = isLoaded
    ? null
    : (skeleton ?? <Skeleton width="100%" height="100%" />);

  return (
    <Stack style={containerStyle}>
      <ExpoImage
        source={resolvedSource}
        style={FULL_SIZE}
        cachePolicy={DEFAULT_CACHE_POLICY}
        recyclingKey={sourceKey || undefined}
        autoplay={autoplay ?? DEFAULT_AUTOPLAY}
        onLoad={handleLoad}
        onLoadStart={onLoadStart}
        onLoadEnd={onLoadEnd}
        onDisplay={onDisplay}
        onError={handleError}
        {...(imageProps as any)}
      />
      {skeletonNode ? (
        <Stack position="absolute" top={0} left={0} right={0} bottom={0}>
          {skeletonNode}
        </Stack>
      ) : null}
    </Stack>
  );
}
