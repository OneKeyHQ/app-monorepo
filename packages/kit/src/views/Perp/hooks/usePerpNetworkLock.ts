import { useCallback, useEffect } from 'react';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';

export function usePerpNetworkLock() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { updateSelectedAccountNetwork } = useAccountSelectorActions().current;

  const arbitrumNetworkId = getNetworkIdsMap().arbitrum; // evm--42161
  const currentNetworkId = activeAccount?.network?.id;

  const switchToArbitrum = useCallback(async () => {
    if (currentNetworkId !== arbitrumNetworkId) {
      console.log('🔄 Switching to Arbitrum network for Perp trading');
      try {
        await updateSelectedAccountNetwork({
          num: 0,
          networkId: arbitrumNetworkId,
        });
        console.log('✅ Successfully switched to Arbitrum network');
      } catch (error) {
        console.error('❌ Failed to switch to Arbitrum network:', error);
      }
    }
  }, [currentNetworkId, arbitrumNetworkId, updateSelectedAccountNetwork]);

  // Auto-switch to Arbitrum when component mounts or when network changes
  useEffect(() => {
    void switchToArbitrum();
  }, [switchToArbitrum]);

  return {
    isOnArbitrum: currentNetworkId === arbitrumNetworkId,
    arbitrumNetworkId,
    currentNetworkId,
    switchToArbitrum,
  };
}
