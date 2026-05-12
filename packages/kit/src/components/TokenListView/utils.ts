// When `mergeDeriveAddressData` is on, the user logically sees the same data
// across every derive type under the same indexedAccountId, so the per-owner
// rendered cache must be keyed by `indexedAccountId`. Otherwise it's keyed by
// the concrete `accountId`. Used by both the cache writer (TokenListView) and
// the eager hydrator (TokenListBlock useLayoutEffect) so writes and reads
// agree on the owner identity — without this, merge-mode switches between
// already-cached networks always miss the cache and the pre-paint hydrate
// path silently no-ops.
export function getTokenListOwnerCacheAccountId(params: {
  accountId?: string;
  indexedAccountId?: string;
  mergeDeriveAddressData?: boolean;
}): string {
  const { accountId, indexedAccountId, mergeDeriveAddressData } = params;
  if (mergeDeriveAddressData && indexedAccountId) return indexedAccountId;
  return accountId ?? '';
}
