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
}: {
  enabled?: boolean;
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
      pollingInterval: enabled
        ? timerUtils.getTimeDurationMs({ seconds: 60 })
        : undefined,
      revalidateOnFocus: true,
    },
  );
  return result;
}
