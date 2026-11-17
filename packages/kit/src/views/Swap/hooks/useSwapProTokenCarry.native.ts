import { useMemo } from 'react';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useSwapProSelectTokenAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';

import { swapProTokenCarryUtils } from '../utils/swapProTokenCarryUtils';
import {
  fetchSwapStableTokenStatus,
  getSwapStableTokenKey,
} from '../utils/swapStableCoinUtils';

type ISwapStableTokenSnapshot = {
  requestKey: string;
  stableTokenKeys: ReadonlySet<string>;
};

const EMPTY_TOKEN_KEYS = new Set<string>();

export function useSwapProTokenCarryOptions({ enabled }: { enabled: boolean }) {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [proToken] = useSwapProSelectTokenAtom();
  const { basicConfig, networkList } = useMarketBasicConfig();
  const candidates = enabled
    ? [fromToken, toToken, proToken].filter((token) => !token?.isStock)
    : [];
  const requestKey = Array.from(
    new Set(candidates.map(getSwapStableTokenKey).filter(Boolean)),
  )
    .toSorted()
    .join('|');
  const requestCandidates = useMemo(
    () => candidates,
    // The canonical key contains every field used by the stable-token API.
    // Balance and price refreshes must not restart the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requestKey],
  );
  const { result } = usePromiseResult<ISwapStableTokenSnapshot>(
    async () => {
      const stableStatusMap =
        await fetchSwapStableTokenStatus(requestCandidates);
      return {
        requestKey,
        stableTokenKeys: new Set(
          Array.from(stableStatusMap.entries()).flatMap(([key, isStable]) =>
            isStable ? [key] : [],
          ),
        ),
      };
    },
    [requestCandidates, requestKey],
    {
      checkIsFocused: false,
      revalidateOnReconnect: true,
      undefinedResultIfReRun: true,
    },
  );

  return useMemo(
    () => ({
      proSupportedNetworkIds:
        enabled && basicConfig
          ? new Set(networkList.map((network) => network.networkId))
          : EMPTY_TOKEN_KEYS,
      stableTokenKeys:
        result?.requestKey === requestKey
          ? result.stableTokenKeys
          : EMPTY_TOKEN_KEYS,
      tokenCarryUtils: enabled ? swapProTokenCarryUtils : undefined,
    }),
    [basicConfig, enabled, networkList, requestKey, result],
  );
}
