import { useEffect } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppSWRCacheScopes } from '@onekeyhq/shared/src/storage/syncStorageKeys';

import {
  buildRecentNetworksSwrKey,
  prependRecentNetworkToSwrCache,
} from './recentNetworksCache';

// Keeps the home selector's "recently used" slot in step with recents written
// by any runtime. The selector's own press handlers write the slot
// synchronously; this covers writers it never sees, such as a dApp
// `wallet_switchEthereumChain` recording the network it left from bg.
// Mounted by the home network trigger, which is what opens that selector.
export function useRecentNetworksCacheSync({
  enabled,
  walletId,
  accountId,
}: {
  enabled: boolean;
  walletId?: string;
  accountId?: string;
}) {
  useEffect(() => {
    if (!enabled || !walletId) {
      return undefined;
    }
    const swrKey = buildRecentNetworksSwrKey({
      scope: EAppSWRCacheScopes.editableChainSelector,
      showAllNetwork: true,
      walletId,
      accountId,
    });
    const onRecorded = ({
      network,
    }: {
      network: Parameters<typeof prependRecentNetworkToSwrCache>[0]['network'];
    }) => {
      prependRecentNetworkToSwrCache({
        swrKey,
        network,
        showAllNetwork: true,
      });
    };
    appEventBus.on(EAppEventBusNames.RecentNetworkRecorded, onRecorded);
    return () => {
      appEventBus.off(EAppEventBusNames.RecentNetworkRecorded, onRecorded);
    };
  }, [accountId, enabled, walletId]);
}
