import { useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppSWRCacheScopes } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import {
  buildRecentNetworksSwrKey,
  prependRecentNetworkToSwrCache,
} from './recentNetworksCache';

// Whether `network` survives the `availableNetworks` filter the home
// selector's RecentNetworks fetcher applies for this wallet/account. The
// recorded list is global: a dApp leaving a network on another wallet's
// account (imported, watching, a BTC-only hardware wallet) must not plant a
// chip here that the fetch would never return.
export async function isRecentNetworkAvailableForAccount({
  network,
  walletId,
  accountId,
}: {
  network: IServerNetwork;
  walletId: string;
  accountId?: string;
}): Promise<boolean> {
  // Not account-scoped; `prependRecentNetworkToSwrCache` gates it by the
  // surface's `showAllNetwork` instead.
  if (networkUtils.isAllNetwork({ networkId: network.id })) {
    return true;
  }
  const { mainnetItems, testnetItems } =
    await backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
      {
        accountId,
        walletId,
        networkIds: [network.id],
      },
    );
  return [...mainnetItems, ...testnetItems].some(
    (item) => item.id === network.id,
  );
}

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
    const onRecorded = ({ network }: { network: IServerNetwork }) => {
      void isRecentNetworkAvailableForAccount({ network, walletId, accountId })
        .then((available) => {
          if (!available) {
            return;
          }
          prependRecentNetworkToSwrCache({
            swrKey,
            network,
            showAllNetwork: true,
          });
        })
        .catch(() => {
          // Leave the slot to the fetch when the compatibility lookup fails.
        });
    };
    appEventBus.on(EAppEventBusNames.RecentNetworkRecorded, onRecorded);
    return () => {
      appEventBus.off(EAppEventBusNames.RecentNetworkRecorded, onRecorded);
    };
  }, [accountId, enabled, walletId]);
}
