import { useCallback, useEffect, useRef } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

export function useNetworkAnalytics(selectedNetworkId: string) {
  // Track previous network to prevent duplicate analytics events
  const prevNetworkId = useRef<string | null>(null);

  // Initialize network tracking to prevent analytics on first load
  useEffect(() => {
    if (selectedNetworkId && prevNetworkId.current === null) {
      prevNetworkId.current = selectedNetworkId;
    }
  }, [selectedNetworkId]);

  const handleNetworkChange = useCallback(
    (
      networkId: string,
      setSelectedNetworkId: (networkId: string) => void,
    ): void => {
      // Skip analytics if network hasn't actually changed (prevent duplicate events)
      if (prevNetworkId.current === networkId) {
        return;
      }

      // Update previous network id
      prevNetworkId.current = networkId;

      // Update the selected network state
      setSelectedNetworkId(networkId);

      console.log('handleNetworkChange', networkId);

      // Track network selection
      defaultLogger.dex.list.dexNetwork({
        network: networkId,
      });
    },
    [],
  );

  return {
    handleNetworkChange,
  };
}
