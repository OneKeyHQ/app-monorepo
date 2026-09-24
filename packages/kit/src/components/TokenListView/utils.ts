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

/**
 * React row keys for the home list, keyed by ASSET rather than by owner
 * (OK-63873). A token's `$key` embeds the account address, so on an account
 * switch every row unmounts and remounts even when both accounts hold the
 * same asset — and with it the row's Token image, which then reloads. Keying
 * shared assets by `${networkId}:${address}` keeps those rows (and their
 * already-decoded images) mounted across the switch while their data props
 * change underneath. Aggregate rows keep their own identity; when several
 * rows resolve to the same asset (merge-derive shows one row per derive
 * address) every one of them falls back to its owner-scoped `$key` so React
 * never sees duplicate keys.
 */
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
      return [token.$key, counts.get(key) === 1 ? key : `owner:${token.$key}`];
    }),
  );
}
