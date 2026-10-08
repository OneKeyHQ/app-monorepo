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
    // Bumped on every reseed so onError can tell apart two probes of the same
    // uri (A -> B -> A): a media element left over from the first A run must
    // not advance the second one.
    generation: number;
    attempt: number;
  }>({ uri, generation: 0, attempt: 0 });
  // Reseed during render whenever the uri changes so a uri that comes back
  // after another one restarts from the first candidate instead of resuming
  // the attempt it failed at earlier.
  const isCurrent = progress.uri === uri;
  if (!isCurrent) {
    setProgress({ uri, generation: progress.generation + 1, attempt: 0 });
  }
  // The reseeding render is discarded by React, but derive the values it would
  // commit anyway so nothing observes the stale progress.
  const attempt = isCurrent ? progress.attempt : 0;
  const generation = isCurrent ? progress.generation : progress.generation + 1;
  const kind: INFTMediaRenderKind = order[attempt] ?? 'failed';

  const onError = useCallback(() => {
    // A media element for a previous uri, or an earlier run of the same uri,
    // may still report its error after the row moved on; only advance the
    // probe generation that rendered it.
    setProgress((prev) =>
      prev.generation === generation
        ? { ...prev, attempt: prev.attempt + 1 }
        : prev,
    );
  }, [generation]);

  return { kind, onError };
}
