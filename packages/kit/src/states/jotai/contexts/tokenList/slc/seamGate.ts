/**
 * TokenList SLC — cell-seam GATE (spec §5, PR-S blocker #1).
 *
 * `resolveUseCellSeam` is the single pure predicate that decides whether a
 * `<TokenListView>` mount binds its leaves to the per-key SLC cells (the HOME
 * projection path) or keeps reading the legacy whole `tokenListMap`.
 *
 * INTENT (spec §5): use cells UNLESS a scoped LP-override map is ACTIVE. The
 * scoped map is held in `useState<Record<string, ITokenFiat>>({})` and is only
 * POPULATED in LP-dapp mode; on the normal home mount it is an EMPTY object
 * (never `undefined`). An empty scoped map therefore MUST count as "no override"
 * — otherwise the seam is dead at runtime on home (the truthiness gate
 * `!props.scopedActiveAccountTokenListMap` is always false for `{}`).
 *
 * Pure: no React / jotai / native / module globals (spec §11.5). This is the
 * unit under seamGate.test.ts.
 */
import type { ITokenFiat } from '@onekeyhq/shared/types/token';

export interface IResolveUseCellSeamParams {
  /** producer is mounted (TokenListBlock sets this). */
  enableCellSeam?: boolean;
  /** TokenSelector path has no producer feeding its cells. */
  isTokenSelector?: boolean;
  /** active-account / scoped list path has no producer feeding its cells. */
  showActiveAccountTokenList?: boolean;
  /**
   * scoped LP-override fiat map. `undefined` OR an empty object both mean "no
   * override" (the home mount passes `{}` from `useState`); a POPULATED map
   * means the LP-dapp scoped path is active and the seam must stay OFF.
   */
  scopedActiveAccountTokenListMap?: Record<string, ITokenFiat>;
}

/**
 * True when the scoped LP-override map is ACTIVE (non-empty). An empty `{}` (the
 * default home state) is NOT an override.
 */
export function hasActiveScopedOverride(
  scopedActiveAccountTokenListMap?: Record<string, ITokenFiat>,
): boolean {
  return (
    !!scopedActiveAccountTokenListMap &&
    Object.keys(scopedActiveAccountTokenListMap).length > 0
  );
}

/**
 * Resolve whether the cell seam (HOME projection path) is active for a
 * `<TokenListView>` mount. True only when the producer is enabled AND this is
 * the global home list — not the TokenSelector, not the active-account list,
 * and not a POPULATED scoped LP-override map.
 */
export function resolveUseCellSeam(params: IResolveUseCellSeamParams): boolean {
  return (
    !!params.enableCellSeam &&
    !params.isTokenSelector &&
    !params.showActiveAccountTokenList &&
    !hasActiveScopedOverride(params.scopedActiveAccountTokenListMap)
  );
}
