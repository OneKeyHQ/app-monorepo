import { useCallback, useMemo, useState } from 'react';

import { getNFTMediaProbeOrder } from '@onekeyhq/shared/src/utils/nftUtils';
import type { INFTMediaKind } from '@onekeyhq/shared/src/utils/nftUtils';

export type INFTMediaRenderKind = INFTMediaKind | 'failed';

/**
 * Walks the NFT media probe order: render the current candidate and advance on
 * its onError until every candidate failed. Progress is keyed to the uri so a
 * recycled list row restarts the probe when its media changes.
 */
export function useNFTMediaFallback(uri: string | undefined) {
  const order = useMemo(() => getNFTMediaProbeOrder(uri), [uri]);
  const [progress, setProgress] = useState<{
    uri: string | undefined;
    attempt: number;
  }>({ uri, attempt: 0 });
  // Reseed during render whenever the uri changes so a uri that comes back
  // after another one restarts from the first candidate instead of resuming
  // the attempt it failed at earlier.
  if (progress.uri !== uri) {
    setProgress({ uri, attempt: 0 });
  }
  const attempt = progress.uri === uri ? progress.attempt : 0;
  const kind: INFTMediaRenderKind = order[attempt] ?? 'failed';

  const onError = useCallback(() => {
    // A media element for a previous uri may still report its error after the
    // row moved on; only advance the probe for the uri currently rendered.
    setProgress((prev) =>
      prev.uri === uri ? { uri, attempt: prev.attempt + 1 } : prev,
    );
  }, [uri]);

  return { kind, onError };
}
