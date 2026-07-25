import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IFetchUSMarketStatusResult } from '@onekeyhq/shared/types/swap/types';

import { usePromiseResult } from './usePromiseResult';

/**
 * Shared US market session status (open/session/reason) for tokenized stocks.
 * Polls per-subscriber; the background service memoizes the request for 20s so
 * many mounted badges/panels still produce at most one network call per window.
 */
export function useUSMarketStatus({
  enabled = true,
  pollingSeconds = 60,
}: {
  enabled?: boolean;
  pollingSeconds?: number;
} = {}): IFetchUSMarketStatusResult | undefined {
  const { result } = usePromiseResult(
    async () => {
      if (!enabled) {
        return undefined;
      }
      return backgroundApiProxy.serviceSwap.fetchCheckUSMarketStatus();
    },
    [enabled],
    {
      pollingInterval: timerUtils.getTimeDurationMs({
        seconds: pollingSeconds,
      }),
      revalidateOnFocus: true,
    },
  );
  return result;
}
