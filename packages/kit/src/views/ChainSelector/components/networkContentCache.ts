import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';

import { scopeAccountIdForWallet } from './selectorCacheScope';

// Slot of the single-network list (`NetworkContentV2` / V1 `NetworkContent`).
// See `scopeAccountIdForWallet` for why the account id is dropped for HD/HW
// wallets: a per-account slot made the first paint after a cross-coin-type
// switch lose the "networks with assets" section and open scrolled to the
// letter section until the fetch landed.
export function buildNetworkContentSwrKey({
  walletId,
  accountId,
  indexedAccountId,
  networkIdsKey,
}: {
  walletId?: string;
  accountId?: string;
  indexedAccountId?: string;
  networkIdsKey?: string;
}) {
  return swrKeys.networkContentData({
    walletId,
    accountId: scopeAccountIdForWallet({ walletId, accountId }),
    indexedAccountId,
    networkIdsKey,
  });
}
