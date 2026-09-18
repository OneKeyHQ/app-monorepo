import { useMemo, useRef, useState } from 'react';

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
// The reset runs during render rather than in an effect because a failing image
// hands the error to its caller synchronously: the caller's swap to the next
// fallback source lands in the same commit, so an effect-based reset would paint
// one frame of the previous source's error state under the new source.
export const useResetError = (
  sourceIdentity: string,
  hasError: boolean,
  onResetError: (hasError: boolean) => void,
) => {
  const [trackedSourceIdentity, setTrackedSourceIdentity] =
    useState(sourceIdentity);
  if (trackedSourceIdentity !== sourceIdentity) {
    setTrackedSourceIdentity(sourceIdentity);
    if (hasError) {
      onResetError(false);
    }
  }
};
