import { useEffect, useMemo, useRef } from 'react';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  fetchSwapStableTokenStatus,
  getSwapStableTokenKey,
} from '@onekeyhq/kit/src/views/Swap/utils/swapStableCoinUtils';
import type { ISwapTokenBase } from '@onekeyhq/shared/types/swap/types';

export function useMarketSwapPayTokens<T extends ISwapTokenBase>({
  tokens,
  enabled,
  configReady,
}: {
  tokens: T[];
  enabled: boolean;
  configReady: boolean;
}) {
  const requestKey =
    enabled && configReady
      ? Array.from(new Set(tokens.map(getSwapStableTokenKey).filter(Boolean)))
          .toSorted()
          .join('|')
      : '';
  const requestTokens = useMemo(
    () => tokens,
    // Token metadata must not restart classification of the same identities.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requestKey],
  );
  const { result } = usePromiseResult(
    async () => ({
      requestKey,
      statuses: requestKey
        ? await fetchSwapStableTokenStatus(requestTokens)
        : new Map<string, boolean>(),
    }),
    [requestKey, requestTokens],
    { revalidateOnReconnect: true },
  );
  const verifiedStatusesRef = useRef<
    { requestKey: string; statuses: Map<string, boolean> } | undefined
  >(undefined);
  const statuses = useMemo(() => {
    if (result?.requestKey !== requestKey) {
      return undefined;
    }
    // Missing classification is unknown; only explicit results replace a
    // previously verified status for the same candidate scope.
    return new Map([
      ...(verifiedStatusesRef.current?.requestKey === requestKey
        ? verifiedStatusesRef.current.statuses
        : []),
      ...result.statuses,
    ]);
  }, [requestKey, result]);
  useEffect(() => {
    if (statuses) {
      verifiedStatusesRef.current = { requestKey, statuses };
    }
  }, [requestKey, statuses]);
  const ready =
    !enabled ||
    (configReady && (!requestKey || result?.requestKey === requestKey));
  const payTokens = useMemo(
    () =>
      enabled
        ? tokens.filter(
            (token) =>
              !token.isNative &&
              ready &&
              statuses?.get(getSwapStableTokenKey(token)) === true,
          )
        : tokens,
    [enabled, ready, statuses, tokens],
  );
  return { payTokens, ready };
}
