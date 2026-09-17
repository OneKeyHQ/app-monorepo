import type { IFuseResult } from '@onekeyhq/shared/src/modules3rdParty/fuse';

export function isSwapSupportAllAccountsRequestCurrent({
  isCancelled,
  requestGeneration,
  currentGeneration,
}: {
  isCancelled: boolean;
  requestGeneration: number;
  currentGeneration: number;
}) {
  return !isCancelled && requestGeneration === currentGeneration;
}

export function releaseSwapTokenListFetchEffectKey({
  effectKey,
  latestEffectKey,
}: {
  effectKey: string;
  latestEffectKey: string;
}) {
  return latestEffectKey === effectKey ? '' : latestEffectKey;
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
