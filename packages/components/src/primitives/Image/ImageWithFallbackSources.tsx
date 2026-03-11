import { useCallback, useEffect, useRef, useState } from 'react';

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
  ...rest
}: IImageWithFallbackSourcesProps) {
  const [index, setIndex] = useState(0);

  const sourcesLengthRef = useRef(sources.length);
  sourcesLengthRef.current = sources.length;

  // Reset index when sources change
  const firstSource = sources[0];
  useEffect(() => {
    setIndex(0);
  }, [firstSource]);

  const handleError = useCallback(
    (event: Parameters<NonNullable<IImageV2Props['onError']>>[0]) => {
      if (index < sourcesLengthRef.current - 1) {
        setIndex((prev) => prev + 1);
      } else {
        onError?.(event);
      }
    },
    [index, onError],
  );

  const currentSrc = sources[index];

  if (!currentSrc) {
    return fallback ?? null;
  }

  return (
    <ImageV2
      {...rest}
      key={currentSrc}
      src={currentSrc}
      fallback={fallback}
      onError={handleError}
      canRetry={false}
    />
  );
}
