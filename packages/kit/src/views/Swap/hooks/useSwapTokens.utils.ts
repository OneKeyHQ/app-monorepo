import type { IFuseResult } from '@onekeyhq/shared/src/modules3rdParty/fuse';

export function releaseSwapTokenListFetchEffectKey({
  effectKey,
  latestEffectKey,
}: {
  effectKey: string;
  latestEffectKey: string;
}) {
  return latestEffectKey === effectKey ? '' : latestEffectKey;
}

export function shouldShowSwapTokenListLoading({
  hasCurrentScopeSnapshot,
  isAllNetworkListReady,
  isSupportAccountsReady,
  isTokenListFetchSettled,
  isTokenListFetching,
}: {
  hasCurrentScopeSnapshot: boolean;
  isAllNetworkListReady: boolean;
  isSupportAccountsReady: boolean;
  isTokenListFetchSettled: boolean;
  isTokenListFetching: boolean;
}) {
  if (hasCurrentScopeSnapshot) {
    return false;
  }

  return (
    !isSupportAccountsReady ||
    !isTokenListFetchSettled ||
    isTokenListFetching ||
    !isAllNetworkListReady
  );
}

// The server also matches aliases that are not present in the display fields.
// Fuse enriches those rows with highlights but must not decide membership.
export function buildServerAuthoritativeSearchResults<T>(
  tokens: T[],
  matchesByToken?: Map<T, IFuseResult<T>['matches']>,
): IFuseResult<T>[] {
  return tokens.map((item, refIndex) => {
    const matches = matchesByToken?.get(item);
    return matches ? { item, refIndex, matches } : { item, refIndex };
  });
}
