import type { IAccountToken } from '@onekeyhq/shared/types/token';

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

// Data keys include the account address. React row keys should identify the
// asset so switching owners can retain its mounted image while replacing data.
export function getHomeTokenListRowKeys(
  tokens: IAccountToken[],
): Map<string, string> {
  const candidateKeys = tokens.map((token) => {
    if (token.isAggregateToken) return `aggregate:${token.$key}`;
    return token.networkId
      ? `asset:${token.networkId}:${token.address}`
      : `owner:${token.$key}`;
  });
  const counts = new Map<string, number>();
  candidateKeys.forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1));
  return new Map(
    tokens.map((token, index) => {
      const key = candidateKeys[index];
      // Multiple derive addresses may expose separate rows of the same asset.
      return [token.$key, counts.get(key) === 1 ? key : `owner:${token.$key}`];
    }),
  );
}
