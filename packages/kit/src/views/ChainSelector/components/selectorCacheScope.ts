import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

// Which account id, if any, belongs in a selector SWR cache key.
//
// For HD/HW wallets the selector's data (compatible networks, per-network
// values, DeFi overview) depends on the wallet and the indexed account only,
// while `accountId` changes with the network's coin type. Scoping a slot by
// it put every network switch into a stale or empty slot (OK-65230). Others
// wallets (imported/watching/external) keep the account: each of their
// accounts has its own network set.
export function scopeAccountIdForWallet({
  walletId,
  accountId,
}: {
  walletId?: string;
  accountId?: string;
}): string | undefined {
  return walletId && accountUtils.isOthersWallet({ walletId })
    ? accountId
    : undefined;
}
