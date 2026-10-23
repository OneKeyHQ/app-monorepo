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
  // The home selector (UnifiedNetworkSelectorV2) never lists All Networks in
  // its chips: NetworkContentV2 hands them mainnet/testnet items only, and the
  // compatibility lookup below drops `onekeyall` as well.
  if (networkUtils.isAllNetwork({ networkId: network.id })) {
    return false;
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
    // Lookups are chained so prepends land in recording order even when an
    // earlier lookup resolves last; otherwise the warm slot could put an
    // older network ahead of a newer one and disagree with the fetch.
    let chain: Promise<void> = Promise.resolve();
    // Clearing the history makes every lookup still in flight stale: the
    // fetch is about to write `[]`, and a late prepend would resurrect a
    // chip the user just removed. The generation captured at event time
    // tells such a result to drop itself.
    let generation = 0;
    const onCleared = () => {
      generation += 1;
    };
    const onRecorded = ({ network }: { network: IServerNetwork }) => {
      const recordedGeneration = generation;
      chain = chain
        .then(() =>
          isRecentNetworkAvailableForAccount({ network, walletId, accountId }),
        )
        .then((available) => {
          if (!available || recordedGeneration !== generation) {
            return;
          }
          prependRecentNetworkToSwrCache({
            swrKey,
            network,
            includeAllNetwork: false,
          });
        })
        .catch(() => {
          // Leave the slot to the fetch when the compatibility lookup fails.
        });
    };
    appEventBus.on(EAppEventBusNames.RecentNetworkRecorded, onRecorded);
    appEventBus.on(EAppEventBusNames.RecentNetworksCleared, onCleared);
    return () => {
      appEventBus.off(EAppEventBusNames.RecentNetworkRecorded, onRecorded);
      appEventBus.off(EAppEventBusNames.RecentNetworksCleared, onCleared);
    };
  }, [accountId, enabled, walletId]);
}
