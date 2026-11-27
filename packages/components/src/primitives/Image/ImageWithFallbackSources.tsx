import { useCallback, useRef, useState } from 'react';

import { ImageV2 } from './ImageV2';

import type { IImageV2Props } from './type';

export type IImageWithFallbackSourcesProps = Omit<
  IImageV2Props,
  'source' | 'src'
> & {
  sources: string[];
};

export function ImageWithFallbackSources({
  sources,
  fallback,
  onError,
  onLoad,
  ...rest
}: IImageWithFallbackSourcesProps) {
  const [index, setIndex] = useState(0);
  const [failedSource, setFailedSource] = useState<string>();

  const sourcesLengthRef = useRef(sources.length);
  sourcesLengthRef.current = sources.length;
  const currentSrc = sources[index];

  // Restart at the primary source during render, not in an effect: an effect
  // would first commit a frame with the previous (now out-of-range) index,
  // which renders the fallback instead of the new image.
  const firstSource = sources[0];
  const [trackedFirstSource, setTrackedFirstSource] = useState(firstSource);
  if (trackedFirstSource !== firstSource) {
    setTrackedFirstSource(firstSource);
    setIndex(0);
    setFailedSource(undefined);
  } else if (
    failedSource !== undefined &&
    failedSource === currentSrc &&
    index < sources.length - 1
  ) {
    // Catalog metadata can add another source after the last image failed.
    setIndex(index + 1);
    setFailedSource(undefined);
  }

  const handleError = useCallback(
    (event: Parameters<NonNullable<IImageV2Props['onError']>>[0]) => {
      if (index < sourcesLengthRef.current - 1) {
        setIndex((prev) => prev + 1);
      } else {
        setFailedSource(currentSrc);
        onError?.(event);
      }
    },
    [currentSrc, index, onError],
  );

  const handleLoad = useCallback(
    (event: Parameters<NonNullable<IImageV2Props['onLoad']>>[0]) => {
      setFailedSource(undefined);
      onLoad?.(event);
    },
    [onLoad],
  );

  if (!currentSrc) {
    return fallback ?? null;
  }

  // No `key={currentSrc}`: remounting on every URL change throws away the
  // already-loaded image state below and forces a blank frame before the new
  // source can paint (visible as an icon flash when switching tokens).
  return (
    <ImageV2
      {...rest}
      src={currentSrc}
      fallback={fallback}
      onError={handleError}
      onLoad={failedSource ? handleLoad : onLoad}
    />
  );
}
