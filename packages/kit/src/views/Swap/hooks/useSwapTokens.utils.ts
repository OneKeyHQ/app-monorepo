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

/**
 * OK-60609: wraps server keyword-search results in the FuseResult shape the
 * selector list consumes. The server is the matching authority — it also
 * matches stock company-name tags that never appear verbatim in
 * symbol/name/contractAddress — so its list must not be filtered down by
 * the local fuse (case-insensitive substring via the extended-search exact
 * operator, no typo tolerance). Fuse matches are attached only to enrich
 * rows with symbol-keyword highlights.
 */
export function buildSwapFuseResultList<T>(
  tokens: T[],
  matchesByToken?: Map<T, IFuseResult<T>['matches']>,
): IFuseResult<T>[] {
  return tokens.map((item, refIndex) => {
    const matches = matchesByToken?.get(item);
    return matches ? { item, refIndex, matches } : { item, refIndex };
  });
}
