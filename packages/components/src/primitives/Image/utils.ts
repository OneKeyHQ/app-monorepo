import { useEffect, useMemo, useRef } from 'react';

import type { ImageSourcePropType, ImageURISource } from 'react-native';

// re-run useEffect via sourceKey.
export const useSourceKey = (source?: ImageSourcePropType) =>
  useMemo(
    () =>
      typeof source === 'object' ? (source as ImageURISource).uri : source,
    [source],
  );

export const useSourceRef = (source?: ImageSourcePropType) => {
  const sourceRef = useRef(source);
  if (sourceRef.current !== source) {
    sourceRef.current = source;
  }
  return sourceRef;
};

export const isEmptyResolvedSource = (source?: ImageSourcePropType | null) => {
  if (!source) {
    return true;
  }
  if (Array.isArray(source)) {
    return source.length === 0;
  }
  return (
    typeof source === 'object' &&
    (source.uri === '' || source.uri === null || source.uri === undefined)
  );
};

export const useResetError = (
  resolvedSource: ImageSourcePropType | null,
  hasError: boolean,
  onResetError: (hasError: boolean) => void,
) => {
  const hasErrorRef = useRef(hasError);
  const resolvedSourceRef = useRef<ImageSourcePropType | null>(resolvedSource);
  hasErrorRef.current = hasError;
  useEffect(() => {
    if (hasErrorRef.current && resolvedSourceRef.current !== resolvedSource) {
      onResetError(false);
    }
    resolvedSourceRef.current = resolvedSource;
  }, [resolvedSource, hasError, onResetError]);
};
