/**
 * TokenListView — SKELETON decision (pure, testable).
 *
 * Extracted 1:1 from the `showSkeleton` useMemo in index.tsx so the branch
 * logic can be unit-tested without RTL (the component is a thin React shell
 * over this predicate, mirroring the cells test philosophy elsewhere).
 *
 * THE LOAD-BEARING RULE (cold-start fix): the home first-load skeleton clause
 * `!initialized && isRefreshing` must ALSO require `displayCount === 0`. The
 * cells cold-start hydrate paints rows into `listStructure` at T0, but the home
 * spot list is `plainMode` and renders `if (showSkeleton) return <ListLoading/>`
 * UNCONDITIONALLY — so without the `displayCount === 0` guard the skeleton hides
 * the cold-painted rows until the network round flips `initialized=true`,
 * defeating cold-start instant paint. Gating on `displayCount === 0` shows the
 * skeleton only when there is genuinely nothing to display yet.
 */
export interface IComputeShowTokenListSkeletonParams {
  showActiveAccountTokenList: boolean;
  activeAccountTokenListInitialized: boolean;
  activeAccountTokenListIsRefreshing: boolean;
  isTokenSelector: boolean;
  searchAll: boolean;
  tokenSelectorSearchKeyLength: number;
  searchKeyLengthThreshold: number;
  tokenSelectorSearchTokenListSearchKey: string;
  tokenSelectorSearchKey: string;
  filteredTokensLength: number;
  ownerMismatch: boolean;
  tokenSelectorInitialized: boolean;
  tokenSelectorSearchTokenStateIsSearching: boolean;
  searchTokenStateIsSearching: boolean;
  tokenListInitialized: boolean;
  tokenListIsRefreshing: boolean;
  /**
   * Post-filter count of rows the list will render (home: projection ids;
   * non-home: filteredTokens). When > 0 there is something to show, so the
   * first-load skeleton must yield (cold-start instant paint).
   */
  displayCount: number;
}

export function computeShowTokenListSkeleton(
  p: IComputeShowTokenListSkeletonParams,
): boolean {
  // Loaded rows belong to a previous owner. Owner switches must show the
  // skeleton even when stale cached rows are still present.
  if (p.ownerMismatch) {
    return true;
  }

  if (
    p.showActiveAccountTokenList &&
    !p.activeAccountTokenListInitialized &&
    p.activeAccountTokenListIsRefreshing &&
    p.displayCount === 0
  ) {
    return true;
  }

  if (
    p.isTokenSelector &&
    p.searchAll &&
    p.tokenSelectorSearchKeyLength >= p.searchKeyLengthThreshold &&
    p.tokenSelectorSearchTokenListSearchKey !== p.tokenSelectorSearchKey &&
    p.filteredTokensLength === 0
  ) {
    return true;
  }

  // PR-3: the selector list is the self-fetched `tokenSelectorTokenList`, not
  // the home atoms. The home mirror keeps `tokenListInitialized` true, so the
  // final clause never fires for the selector and it would flash EmptyToken for
  // a frame before the self-fetch lands. Skeleton until the selector self-fetch
  // resolves, but only when there is genuinely nothing cached to display.
  if (
    p.isTokenSelector &&
    !p.showActiveAccountTokenList &&
    !p.tokenSelectorInitialized &&
    p.displayCount === 0
  ) {
    return true;
  }

  return (
    (p.isTokenSelector && p.tokenSelectorSearchTokenStateIsSearching) ||
    (!p.isTokenSelector && p.searchTokenStateIsSearching) ||
    // Cold-start fix: only skeleton the first load when there is NOTHING to
    // display. A cold paint (or any landed frame) makes displayCount > 0 and
    // the rows render immediately instead of being hidden by the skeleton.
    (!p.tokenListInitialized && p.tokenListIsRefreshing && p.displayCount === 0)
  );
}
