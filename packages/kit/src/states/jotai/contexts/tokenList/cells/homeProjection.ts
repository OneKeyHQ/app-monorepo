/**
 * TokenList cells — HOME render-order PURE PROJECTION (spec §1, §8#5, §11.3).
 *
 * `projectHomeDisplayIds` derives the HOME token-list display order from a
 * projection over `orderedIds ∪ smallBalanceIds`, reading per-id fiat/meta
 * values through `getFiat`/`getMeta` callbacks — NEVER from the whole
 * `{...tokenListMap, ...aggregateTokenMap}` object. This is what lets a single
 * price tick avoid an O(N) list recompute: the component recomputes the
 * projection only on a STRUCTURE frame (generation bump) or a search / sort /
 * hideZero change, and the per-id reads inside are non-reactive store snapshots.
 *
 * Pure: no React / jotai / native / module globals (spec §11.5). This is the
 * unit under the node parity tests (homeProjection.test.ts), which assert the
 * sort (price/value/name), search, and hideZero output matches the legacy
 * whole-map `filteredTokens` path for the home case.
 *
 * STRICT SCOPE: HOME path ONLY. The TokenSelector path (network search,
 * searchAll, contextTokenListMap override) keeps its existing whole-map
 * `filteredTokens` useMemo — it is NOT routed through this fn (spec §1, PR-S
 * scope; TokenSelector migrates in PR-N).
 */
import BigNumber from 'bignumber.js';

import type { ITokenKey } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/types';
import { SEARCH_KEY_MIN_LENGTH } from '@onekeyhq/shared/src/consts/walletConsts';
import { ETokenListSortType } from '@onekeyhq/shared/types/token';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

export interface IProjectHomeDisplayIdsParams {
  /** producer-sorted high-value ids. */
  orderedIds: ITokenKey[];
  /** appended small-balance ids (only merged in when searching). */
  smallBalanceIds: ITokenKey[];
  /** hideZero membership set ids (computeNonZeroIds output). */
  nonZeroIds: ITokenKey[];
  searchKey: string;
  /** defaults to SEARCH_KEY_MIN_LENGTH (mirrors index.tsx home search-gate). */
  searchKeyLengthThreshold?: number;
  sortType: ETokenListSortType;
  sortDirection: 'asc' | 'desc';
  hideZero: boolean;
  /**
   * HOME DeFi/dapp-marked exclusion (PR-S blocker #2). Mirrors the legacy
   * `resultTokens.filter(item => !isTokenSelectorDappToken(item))` gate
   * (index.tsx home `tokens` memo) — TokenListBlock passes
   * `hideDeFiMarkedTokens={!showLpTokensOnly}` = TRUE on the normal home list.
   * An id is dapp-marked when its meta carries a non-empty `dappName`. Defaults
   * to `false` (no exclusion) for non-home callers / tests.
   */
  hideDeFiMarked?: boolean;
  /** non-reactive per-id fiat read (store snapshot). */
  getFiat: (key: ITokenKey) => ITokenFiat | undefined;
  /** non-reactive per-id meta read (store snapshot). */
  getMeta: (key: ITokenKey) => IToken | undefined;
  /**
   * aggregate sub-token map (allAggregateTokenMap). Needed for the aggregate
   * address-search parity branch (a sub-token address match keeps the agg row),
   * because per-id meta does NOT carry sub-token addresses (spec §11.4 risk #6).
   */
  aggregateTokenListMap?: Record<string, { tokens: IToken[] }>;
}

/**
 * Replica of the private `tokenFieldsContainKeyword` (tokenUtils.ts:108-116),
 * inlined here so `@onekeyhq/shared` stays untouched (the original is not
 * exported). Four-field check: name/symbol/commonSymbol contains kw OR address
 * === kw (all lowercased). `kw` MUST already be trimmed + lowercased.
 */
function metaFieldsContainKeyword(meta: IToken, kw: string): boolean {
  return (
    meta.name?.toLowerCase().includes(kw) ||
    meta.symbol?.toLowerCase().includes(kw) ||
    meta.commonSymbol?.toLowerCase().includes(kw) ||
    meta.address?.toLowerCase() === kw ||
    false
  );
}

/**
 * Dapp/DeFi-marked predicate, replicating `isTokenSelectorDappToken`
 * (tokenSelectorFilterUtils.ts: `Boolean(dappName?.trim())`). Inlined here so
 * the projection stays a pure leaf with no cross-package import churn.
 */
function isDappMarkedMeta(meta: IToken | undefined): boolean {
  return Boolean(meta?.dappName?.trim());
}

/**
 * Stable comparator helpers replicating the BigNumber + fallback semantics of
 * `sortTokensByFiatValue` (fiatValue ?? -1, NaN -> -1) and `sortTokensByPrice`
 * (price ?? 0, NaN -> 0) EXACTLY (spec §11.4 risk #1). Do NOT collapse missing
 * fiat to 0 here — it diverges from the -1 fallback for the Value sort.
 */
function fiatValueOf(fiat: ITokenFiat | undefined): BigNumber {
  const n = new BigNumber(fiat?.fiatValue ?? -1);
  return n.isNaN() ? new BigNumber(-1) : n;
}

function priceOf(fiat: ITokenFiat | undefined): BigNumber {
  const n = new BigNumber(fiat?.price ?? 0);
  return n.isNaN() ? new BigNumber(0) : n;
}

/**
 * Stable sort over an index-tagged array so equal keys preserve the incoming
 * (producer) order — matching `Array.prototype.toSorted` stability used by the
 * legacy helpers (spec §11.4 risk #2). `compare` returns the desc-orientation
 * comparison; direction flips it.
 */
function stableSort(
  ids: ITokenKey[],
  sortDirection: 'asc' | 'desc',
  compareDesc: (a: ITokenKey, b: ITokenKey) => number,
): ITokenKey[] {
  const tagged = ids.map((id, index) => ({ id, index }));
  tagged.sort((x, y) => {
    const c =
      sortDirection === 'desc'
        ? compareDesc(x.id, y.id)
        : -compareDesc(x.id, y.id);
    if (c !== 0) {
      return c;
    }
    return x.index - y.index;
  });
  return tagged.map((t) => t.id);
}

/**
 * Project the HOME display id order.
 *
 * Pipeline (mirrors index.tsx home path):
 *   (a) base ids: search-gated composition — orderedIds ∪ smallBalanceIds when
 *       searching, orderedIds only otherwise (index.tsx:308-313). Note: even
 *       below the search threshold the union is NOT applied, matching the
 *       legacy `tokenList.tokens` (orderedIds) only non-search composition.
 *   (b) hideZero: keep only ids ∈ nonZeroIds.
 *   (b2) hideDeFiMarked: drop ids whose meta carries a non-empty dappName
 *       (mirrors the legacy `!isTokenSelectorDappToken` home filter).
 *   (c) search: non-network keyword filter (index.tsx home never enables
 *       network search) — meta field match OR aggregate sub-token address match.
 *   (d) sort: applied unconditionally for home (index.tsx sorts non-selector
 *       after search), with the exact BigNumber/fallback semantics of the
 *       legacy sort helpers.
 */
export function projectHomeDisplayIds(
  params: IProjectHomeDisplayIdsParams,
): ITokenKey[] {
  const {
    orderedIds,
    smallBalanceIds,
    nonZeroIds,
    searchKey,
    searchKeyLengthThreshold,
    sortType,
    sortDirection,
    hideZero,
    hideDeFiMarked,
    getFiat,
    getMeta,
    aggregateTokenListMap,
  } = params;

  const threshold = searchKeyLengthThreshold ?? SEARCH_KEY_MIN_LENGTH;
  const isSearching = !!searchKey && searchKey.length >= threshold;

  // (a) base composition — search-gated small-balance merge (risk #3).
  let ids: ITokenKey[] = isSearching
    ? [...orderedIds, ...smallBalanceIds]
    : [...orderedIds];

  // (b) hideZero membership filter (risk #4/#5: nonZeroIds is authoritative,
  // including keepDefault default/custom hits computed by computeNonZeroIds).
  if (hideZero) {
    const nonZeroSet = new Set(nonZeroIds);
    ids = ids.filter((key) => nonZeroSet.has(key));
  }

  // (b2) hideDeFiMarked: drop dapp/DeFi-marked ids (non-empty meta.dappName),
  // replicating the legacy home `!isTokenSelectorDappToken(item)` filter
  // (index.tsx home `tokens` memo). Without this, once the seam activates the
  // home list would show dapp-marked tokens the legacy path hides (blocker #2).
  if (hideDeFiMarked) {
    ids = ids.filter((key) => !isDappMarkedMeta(getMeta(key)));
  }

  // (c) search filter — non-network branch of getFilteredTokenBySearchKey.
  if (isSearching) {
    const kw = searchKey.trim().toLowerCase();
    ids = ids.filter((key) => {
      const meta = getMeta(key);
      if (meta?.isAggregateToken) {
        const subTokens = aggregateTokenListMap?.[key]?.tokens;
        if (subTokens?.some((t) => t.address?.toLowerCase() === kw)) {
          return true;
        }
      }
      if (!meta) {
        return false;
      }
      return metaFieldsContainKeyword(meta, kw);
    });
  }

  // (d) sort — unconditional on home (matches index.tsx non-selector sort).
  if (sortType === ETokenListSortType.Price) {
    ids = stableSort(ids, sortDirection, (a, b) =>
      priceOf(getFiat(b)).comparedTo(priceOf(getFiat(a))),
    );
  } else if (sortType === ETokenListSortType.Value) {
    ids = stableSort(ids, sortDirection, (a, b) =>
      fiatValueOf(getFiat(b)).comparedTo(fiatValueOf(getFiat(a))),
    );
  } else if (sortType === ETokenListSortType.Name) {
    ids = stableSort(ids, sortDirection, (a, b) => {
      const aName = getMeta(a)?.name?.toLowerCase() ?? '';
      const bName = getMeta(b)?.name?.toLowerCase() ?? '';
      return bName.localeCompare(aName);
    });
  }

  return ids;
}
