import { useCallback } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

export function useNetworkLoadingAnalytics() {
  const trackNetworkLoading = useCallback(
    (network: string, tokenLoading: number) => {
      defaultLogger.dex.list.dexNetworkLoading({
        network,
        tokenLoading,
      });
    },
    [],
  );

  return {
    trackNetworkLoading,
  };
}
