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
  const attempt = progress.uri === uri ? progress.attempt : 0;
  const kind: INFTMediaRenderKind = order[attempt] ?? 'failed';

  const onError = useCallback(() => {
    setProgress((prev) =>
      prev.uri === uri
        ? { uri, attempt: prev.attempt + 1 }
        : { uri, attempt: 1 },
    );
  }, [uri]);

  return { kind, onError };
}
