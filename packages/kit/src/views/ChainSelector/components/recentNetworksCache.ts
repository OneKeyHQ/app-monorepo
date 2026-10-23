import { RECENT_NETWORKS_LIMIT } from '@onekeyhq/shared/src/consts/networkConsts';
import type { EAppSWRCacheScopes } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { scopeAccountIdForWallet } from './selectorCacheScope';

// The recent-network list is global (simpleDb `recentNetworks`); the cache
// slot only has to follow the `availableNetworks` filter the fetcher applies,
// which is per wallet for HD/HW and per account for others wallets — see
// `scopeAccountIdForWallet`. A per-account slot put every network switch into
// a stale or empty slot and the chip row (and the list under it) jumped once
// the fresh list landed (OK-65230).
export function buildRecentNetworksSwrKey({
  scope,
  showAllNetwork,
  walletId,
  accountId,
}: {
  scope: EAppSWRCacheScopes;
  showAllNetwork: boolean;
  walletId?: string;
  accountId?: string;
}) {
  return swrKeys.recentNetworks({
    scope,
    showAllNetwork,
    walletId,
    accountId: scopeAccountIdForWallet({ walletId, accountId }),
  });
}

// Mirror `updateRecentNetwork` into the UI-owned SWR slot right when the user
// leaves a network. The slot was last written when the chips resolved, i.e.
// before this press, so without this the next open would paint the previous
// list and then grow by one chip when the fetch returned. A cold slot is left
// alone: the fetch fills it and there is nothing to keep stable yet.
export function prependRecentNetworkToSwrCache({
  swrKey,
  network,
  showAllNetwork,
}: {
  swrKey: string | undefined;
  network: IServerNetwork | undefined;
  showAllNetwork: boolean;
}) {
  if (!swrKey || !network) {
    return;
  }
  if (!showAllNetwork && networkUtils.isAllNetwork({ networkId: network.id })) {
    return;
  }
  const cached = swrCacheUtils.get<IServerNetwork[]>(swrKey);
  if (!Array.isArray(cached)) {
    return;
  }
  const next = [
    network,
    ...cached.filter((item) => item.id !== network.id),
  ].slice(0, RECENT_NETWORKS_LIMIT);
  swrCacheUtils.set(swrKey, next);
}
