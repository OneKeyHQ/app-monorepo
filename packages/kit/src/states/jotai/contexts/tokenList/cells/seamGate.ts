/**
 * TokenList cells — cell-seam GATE (spec §5, PR-S blocker #1).
 *
 * `resolveUseCellSeam` is the single pure predicate that decides whether a
 * `<TokenListView>` mount binds its leaves to the per-key cells (the HOME
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

// NOTE(seam is PERMANENT, do NOT plan to delete it — audited 2026-06-16):
// The cell path (fast, per-key, home) and the legacy whole-`tokenListMap` path
// (seam OFF) are a deliberate TWO-MODE architecture, not transitional debt. The
// seam-OFF paths CANNOT be moved onto cells by "threading" because their data
// never enters the BG VM per-owner round pipeline (the only `ingestRound` caller
// is home/TokenListBlock):
//   - scoped-LP override (`hasActiveScopedOverride`): a UI-only `useState` dapp
//     map (TokenListBlock `scopedLpTokenListMap`, TokenSelector
//     `scopedActiveTokenListMap`). It overlays LP prices on a subset of the list
//     — there is NO ownerKey and `ingestRound` (REPLACE semantics) cannot express
//     it. Making this cell-fed needs a NEW BG VM round/frame type, not a refactor.
//     => PERMANENT.
//   - TokenSelector (search / all-networks / custom-token-add) and the
//     active-account / cross-account list: their fetches don't flow through a
//     per-owner round, so there are no frames to subscribe to. Migrating is a
//     pipeline re-architecture, not threading. => keep legacy unless redesigned.
//   - AssetList host is the only seam-OFF path that is owner-shaped and could
//     plausibly host a producer later — moderate work, do it standalone if ever.
// Deleting the seam would blank these screens to `-` (an empty cell registry with
// no producer). Keep this module + its test as the documented mode selector.
//
// DO NOT hoist the value leaves' `useTokenFiat` up to the row (TokenListItem):
// TokenListItem does NOT subscribe to fiat today, so a price tick re-renders ONLY
// the 4 small memo'd value leaves, not the row (icon/name/actions stay put). The
// per-leaf split is INTENTIONAL tick isolation. Hoisting widens every tick to the
// whole row (regressing the hot path the cells exist to protect); the 4→1
// subscription "saving" is on the SAME cell in lockstep (~0 cost) and would also
// strand RiskTokenManager, which composes these leaves WITHOUT TokenListItem.
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
