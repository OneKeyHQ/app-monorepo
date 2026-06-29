/**
 * TokenList cells — single source of truth for the home token-list per-owner
 * key (design 2026-06-16).
 *
 * The BG per-owner ViewModel is keyed by `${ownerAccountId}__${networkId}`,
 * where `ownerAccountId` is the `indexedAccountId` in merge-derive mode and the
 * concrete `accountId` otherwise (see `getTokenListOwnerCacheAccountId`). This
 * exact string is BOTH the WRITE key (TokenListBlock → `ingestRound`) and the
 * READ key (`useHomeTokenListSnapshot` → `getRawTokenList` / `getAllTokenListMap`,
 * which do `vmByOwner.get(ownerKey)` with NO fallback). If the two sides drift,
 * the snapshot pull misses the BG entry and returns EMPTY — breaking the
 * callback-snapshot consumers (WalletActions / MoreActionButton / FiatCrypto /
 * UniversalSearch) in merge-derive mode.
 *
 * To prevent that drift, BOTH sides compute the key here. `mergeDeriveAddressData`
 * is derived EXACTLY the way `TokenListBlock` does (TokenListBlock.tsx:270-273):
 * `vaultSettings?.mergeDeriveAssetsEnabled && !isOthersWallet(walletId) &&
 * deriveInfoItems.length > 1`, all read off the same `useActiveAccount` slot.
 */
import { getTokenListOwnerCacheAccountId } from '@onekeyhq/kit/src/components/TokenListView/utils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useActiveAccount } from '../../accountSelector';

/**
 * The home token-list BG per-owner key, byte-for-byte identical on the
 * `ingestRound` WRITE side and the snapshot PULL READ side. `num` selects the
 * account-selector slot (defaults to the home slot 0). Returns `''` when the
 * owner identity is not yet resolvable (no owner accountId or no network id).
 */
export function useHomeTokenListOwnerKey(num = 0): string {
  const {
    activeAccount: {
      account,
      indexedAccount,
      network,
      wallet,
      deriveInfoItems,
      vaultSettings,
    },
  } = useActiveAccount({ num });

  // Mirror of TokenListBlock.tsx:270-273 — keep these in lock-step.
  const mergeDeriveAddressData =
    vaultSettings?.mergeDeriveAssetsEnabled &&
    !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' }) &&
    deriveInfoItems.length > 1;

  const ownerAccountId = getTokenListOwnerCacheAccountId({
    accountId: account?.id,
    indexedAccountId: indexedAccount?.id,
    mergeDeriveAddressData: !!mergeDeriveAddressData,
  });

  return ownerAccountId && network?.id
    ? `${ownerAccountId}__${network.id}`
    : '';
}
