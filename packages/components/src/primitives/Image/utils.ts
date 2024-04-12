import { useMemo, useRef } from 'react';

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
