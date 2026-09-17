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

// Keyed by request identity rather than object identity: callers commonly pass
// a fresh `{ uri }` object on every render, which must not clear a failed load
// and remount the image (visible as a placeholder flash plus a refetch).
export const useResetError = (
  sourceIdentity: string,
  hasError: boolean,
  onResetError: (hasError: boolean) => void,
) => {
  const hasErrorRef = useRef(hasError);
  const sourceIdentityRef = useRef(sourceIdentity);
  hasErrorRef.current = hasError;
  useEffect(() => {
    if (hasErrorRef.current && sourceIdentityRef.current !== sourceIdentity) {
      onResetError(false);
    }
    sourceIdentityRef.current = sourceIdentity;
  }, [sourceIdentity, hasError, onResetError]);
};
