import { useEffect, useMemo, useRef } from 'react';

import type { ImageSource } from 'expo-image';
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

export const isEmptyResolvedSource = (source?: ImageSource | null) => {
  return (
    !source ||
    (typeof source === 'object' &&
      ((source as ImageURISource).uri === '' ||
        source.uri === null ||
        source.uri === undefined))
  );
};

export const useResetError = (
  resolvedSource: ImageSource | null,
  hasError: boolean,
  onResetError: (hasError: boolean) => void,
) => {
  const hasErrorRef = useRef(hasError);
  const resolvedSourceRef = useRef<ImageSource | null>(resolvedSource);
  hasErrorRef.current = hasError;
  useEffect(() => {
    if (hasErrorRef.current && resolvedSourceRef.current !== resolvedSource) {
      onResetError(false);
    }
    resolvedSourceRef.current = resolvedSource;
  }, [resolvedSource, hasError, onResetError]);
};
