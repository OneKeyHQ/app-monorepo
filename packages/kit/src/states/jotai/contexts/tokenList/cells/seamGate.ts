/**
 * TokenList cells — cell-seam GATE (spec §5, PR-S blocker #1).
 *
 * `resolveUseCellSeam` is the single pure predicate that decides whether a
 * `<TokenListView>` mount binds its leaves to the per-key cells (the HOME
 * projection path) or keeps reading the legacy whole `tokenListMap`.
 *
 * INTENT (spec §5): use cells UNLESS the mount DISPLAYS a non-home list (the
 * TokenSelector or the scoped active-account / LP-dapp list). The gate takes
 * display-MODE flags ONLY — never data. The scoped LP map
 * (`scopedActiveAccountTokenListMap`) is deliberately NOT an input: it is
 * consumed exclusively when `showActiveAccountTokenList` is true (the only
 * mode that renders it), and TokenListBlock holds the LAST fetched map in
 * `useState` after the home DeFi-token switch turns OFF. Gating on the map's
 * content made that residue flip the home list onto the legacy path — which
 * has NO data source on home (`hostTokenList` is undefined) — blanking the
 * list until a PortfolioContainer remount (wallet/network switch). See the
 * DeFi-switch regression case in seamGate.test.ts.
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
//   - scoped-LP override (`showActiveAccountTokenList`): a UI-only `useState` dapp
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
  /**
   * active-account / scoped (LP-dapp) list path has no producer feeding its
   * cells. This flag is the ONLY authority for the scoped mode — the scoped
   * map's content must never gate the seam (see header: DeFi-switch residue).
   */
  showActiveAccountTokenList?: boolean;
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
 * the global home list — not the TokenSelector, not the active-account /
 * LP-dapp scoped display mode.
 */
export function resolveUseCellSeam(params: IResolveUseCellSeamParams): boolean {
  return (
    !!params.enableCellSeam &&
    !params.isTokenSelector &&
    !params.showActiveAccountTokenList
  );
}
