/**
 * TokenList cells — buildFrames PURE MAPPING (spec §4.1, §11.5).
 *
 * Derives the two wire frames from ONE fetch round's already-settled data:
 *   - a STRUCTURE frame (orderedIds / smallBalanceIds / nonZeroIds /
 *     aggMembership / metaPatch / smallBalanceFiatValue), and
 *   - a VALUATION frame (changedFiatById / changedAggFiat).
 *
 * Pure data in / pure data out — no React, no jotai, no native, no module
 * globals (spec §11.5). The producer (TokenListBlock) gathers the round's
 * inputs from the existing atoms, calls `buildFrames`, then feeds the two
 * frames to `applyStructureSnapshot` / `applyValuationFrame`.
 *
 * Structure-vs-valuation split (spec §4.1):
 *   - A STRUCTURE frame is emitted ONLY when the structure changes: a different
 *     owner, a different ordered/smallBalance id set, changed aggregate
 *     membership, a changed meta, or a changed smallBalanceFiatValue scalar.
 *   - A pure price tick (same ids, same membership, same metas, only fiat
 *     values move) emits NO structure frame — `structure` comes back
 *     `undefined` and only the valuation frame is applied. This keeps
 *     `listStructureAtom` low-frequency, the premise of "only the changed leaf
 *     re-renders" (spec §4.1, §5).
 */
import BigNumber from 'bignumber.js';

import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IAccountToken,
  ICustomTokenItem,
  IHomeDefaultToken,
  IToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import {
  computeFundedIds,
  computeNonZeroIds,
  isAgg,
  metaEqual,
  shallowEqualArrayOf,
} from './pure';

import type {
  IAggKey,
  IListStructure,
  INetworkId,
  IStructureSnapshot,
  ITokenKey,
  IValuationFrame,
} from './types';

/**
 * One fetch round's settled inputs. These mirror exactly what the home
 * producer already has in the per-store atoms after a refresh* settle:
 *   - the high-value `tokenList.tokens`,
 *   - the `smallBalanceTokenList.smallBalanceTokens`,
 *   - the flat `$key -> ITokenFiat` map (normal + small-balance merged, as the
 *     view already merges them),
 *   - the nested aggregate map `aggKey -> networkId -> ITokenFiat`
 *     (`aggregateTokensMapAtom` shape), and
 *   - the small-balance fiat scalar.
 */
export interface IBuildFramesInput {
  orderedTokens: IAccountToken[];
  smallBalanceTokens: IAccountToken[];
  /** `$key -> ITokenFiat` — normal + small-balance merged (view path). */
  tokenListMap: Record<ITokenKey, ITokenFiat>;
  /** nested aggregate map `aggKey -> networkId -> ITokenFiat`. */
  aggregateTokensMap: Record<IAggKey, Record<INetworkId, ITokenFiat>>;
  /**
   * Per-`$key` OWNED aggregate sub-token METADATA list (`{ tokens }`). The SAME
   * value the home producer fed to `refreshAggregateTokensListMap`. Carried onto
   * the emitted structure frame (full-delete PR-7) so the home cell-path leaves
   * source it from `listStructureAtom`. Metadata only — never summed. Optional
   * for older callers / tests (defaults to `{}`).
   */
  ownedAggregateTokenListMap?: Record<IAggKey, { tokens: IAccountToken[] }>;
  smallBalanceFiatValue: string;
  ownerKey: string;
  /** identity check payload (NOT a string id) — see resolveCurrentStore. */
  storeData: IJotaiContextStoreData;
  /**
   * hideZero "keep default zero-balance" inputs (spec §8#2, PR-S Step 3).
   * Threaded from the home producer so `nonZeroIds` is AUTHORITATIVE for the
   * HOME hideZero render path — not balance-only. When omitted (older callers /
   * tests), `computeNonZeroIds` falls back to the balance>0 branch only, which
   * matches the prior balance-only nonZeroIds behavior.
   */
  keepDefault?: boolean;
  homeDefaultTokenMap?: Record<string, IHomeDefaultToken>;
  customTokens?: ICustomTokenItem[];
}

/**
 * The previous structure as applied to `listStructureAtom`, plus the last
 * smallBalanceFiatValue. Used to decide whether a structure frame is needed and
 * to compute the next monotonic generation. The producer reads this from
 * `listStructureAtom` (ids/membership/ownerKey/generation) and keeps the scalar
 * in a ref.
 */
export interface IBuildFramesPrev {
  structure: Pick<
    IListStructure,
    | 'orderedIds'
    | 'smallBalanceIds'
    | 'nonZeroIds'
    | 'fundedIds'
    | 'aggMembership'
    | 'ownerKey'
    | 'generation'
    | 'ownedAggregateTokenListMap'
  >;
  smallBalanceFiatValue: string;
  /** previously-applied meta by `$key`, for meta-change detection. */
  metaByKey: Record<ITokenKey, IToken | undefined>;
}

export interface IBuildFramesResult {
  /** `undefined` when nothing structural changed (pure price tick). */
  structure?: IStructureSnapshot;
  valuation: IValuationFrame;
}

/**
 * Shallow equality of an aggKey -> `{ tokens }` list-map. Compares the set of
 * agg keys and, per key, the `$key` sequence of the nested `tokens` array. This
 * catches a sub-token swap that does NOT change `aggMembership` (e.g. the same
 * networks but a different sub-token set) so the structure frame still re-emits
 * and the cell-path leaves see the new sub-token list (full-delete PR-7).
 */
function aggregateListMapEqual(
  a: Record<IAggKey, { tokens: IAccountToken[] }>,
  b: Record<IAggKey, { tokens: IAccountToken[] }>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const k of aKeys) {
    const bv = b[k];
    if (!bv) {
      return false;
    }
    const aTokens = a[k].tokens;
    const bTokens = bv.tokens;
    if (aTokens.length !== bTokens.length) {
      return false;
    }
    for (let i = 0; i < aTokens.length; i += 1) {
      if (aTokens[i].$key !== bTokens[i].$key) {
        return false;
      }
    }
  }
  return true;
}

/** Shallow equality of an aggKey -> networkId[] membership map. */
function aggMembershipEqual(
  a: Record<IAggKey, INetworkId[]>,
  b: Record<IAggKey, INetworkId[]>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const k of aKeys) {
    const bv = b[k];
    if (!bv || !shallowEqualArrayOf(a[k], bv)) {
      return false;
    }
  }
  return true;
}

/**
 * Monotonic generation: bump by one. On an owner switch the apply layer resets
 * `curGeneration` to -1 (clearAll), so any non-negative generation passes the
 * gen guard — we still bump from the previous value to stay monotonic within a
 * session and avoid `0 <= 0` self-drop right after a reset (start the new owner
 * at the previous gen + 1).
 */
function nextGeneration(prevGeneration: number, ownerChanged: boolean): number {
  const base = ownerChanged ? Math.max(prevGeneration, -1) : prevGeneration;
  return base + 1;
}

/**
 * Build the structure + valuation frames for one fetch round.
 *
 * The valuation frame always carries the full current fiat by `$key` and the
 * full current aggregate-by-network map; the apply layer's `fiatEqual` guard
 * makes unchanged cells no-op, so this stays O(changed) at the cell-write level
 * even though the producer passes the whole map (spec §11.2). Keeping the
 * valuation payload complete also lets `applyValuationFrame` self-heal after a
 * structure frame adds new cells.
 */
export function buildFrames(
  input: IBuildFramesInput,
  prev: IBuildFramesPrev,
): IBuildFramesResult {
  const {
    orderedTokens,
    smallBalanceTokens,
    tokenListMap,
    aggregateTokensMap,
    ownedAggregateTokenListMap = {},
    smallBalanceFiatValue,
    ownerKey,
    storeData,
    keepDefault = false,
    homeDefaultTokenMap,
    customTokens,
  } = input;

  // --- ids -----------------------------------------------------------------
  const orderedIds: ITokenKey[] = orderedTokens.map((t) => t.$key);
  const smallBalanceIds: ITokenKey[] = smallBalanceTokens.map((t) => t.$key);

  // --- meta patch ----------------------------------------------------------
  // One entry per token in either list. The meta cell write path uses
  // metaEqual, so passing every meta is fine; the structure-change check below
  // narrows whether a STRUCTURE frame is emitted at all.
  const metaPatch: Record<ITokenKey, IToken> = {};
  const allTokens: IAccountToken[] = [...orderedTokens, ...smallBalanceTokens];
  for (const token of allTokens) {
    // strip the `$key` so the stored meta is a plain IToken; readers index the
    // meta cell by `$key` already.
    const { $key, ...rest } = token;
    metaPatch[$key] = rest;
  }

  // --- aggregate membership ------------------------------------------------
  // aggKey -> the networkIds present in the nested map. This is the source of
  // both `aggMembership` (structure) and `changedAggFiat` (valuation).
  const aggMembership: Record<IAggKey, INetworkId[]> = {};
  const changedAggFiat: Record<IAggKey, Record<INetworkId, ITokenFiat>> = {};
  for (const aggKey of Object.keys(aggregateTokensMap)) {
    const byNet = aggregateTokensMap[aggKey];
    const netIds = Object.keys(byNet);
    aggMembership[aggKey] = netIds;
    changedAggFiat[aggKey] = { ...byNet };
  }

  // --- nonZeroIds (HOME hideZero authority, spec §8#2, PR-S Step 3) --------
  // Computed via the shared pure `computeNonZeroIds` so the structure atom's
  // `nonZeroIds` mirrors the full 3-branch in-view hideZero predicate:
  //   1. balance > 0, OR
  //   2. keepDefault AND homeDefaultTokenMap hit AND (isNative || isAggregate),
  //      OR
  //   3. keepDefault AND customTokens hit ($key OR address+networkId).
  // Aggregate ids resolve their balance from the per-network fiat sum (via the
  // nested aggregateTokensMap) since they don't live in `tokenListMap`. This
  // makes `nonZeroChanged` a CORRECT structure-frame trigger for the HOME
  // hideZero list (a balance crossing 0 flips membership -> structure frame).
  const allListIds: ITokenKey[] = [...orderedIds, ...smallBalanceIds];

  // Aggregate-aware fiat resolver shared by BOTH `nonZeroIds` and `fundedIds`:
  // aggregate ids don't live in `tokenListMap`, so resolve their balance from the
  // per-network fiat sum (mirrors the in-view aggregate read). Non-aggregate ids
  // read straight from `tokenListMap`.
  const getAggAwareFiat = (key: string): ITokenFiat | undefined => {
    if (isAgg(key, metaPatch[key])) {
      const byNet = aggregateTokensMap[key];
      if (!byNet) {
        return undefined;
      }
      let bal = new BigNumber(0);
      for (const f of Object.values(byNet)) {
        bal = bal.plus(f?.balance ?? 0);
      }
      return { balance: bal.toFixed() } as ITokenFiat;
    }
    return tokenListMap[key];
  };

  const nonZeroIds: ITokenKey[] = computeNonZeroIds({
    ids: allListIds,
    getFiat: getAggAwareFiat,
    getMeta: (key) => metaPatch[key],
    keepDefault,
    homeDefaultTokenMap,
    customTokens,
  });

  // --- fundedIds (STRICT balance>0 set, PR-0 full-delete enabler) ----------
  // DISTINCT from `nonZeroIds`: NO keepDefault retention — a fresh 0-balance
  // default/native/custom token is NOT funded. Same agg-aware per-network sum so
  // an aggregate is funded iff its summed balance > 0. This is the correct
  // `hasHoldingsNow` signal a later PR migrates onto.
  const fundedIds: ITokenKey[] = computeFundedIds({
    ids: allListIds,
    getFiat: getAggAwareFiat,
  });

  // --- valuation: normal token fiat ---------------------------------------
  // Full current fiat for every NON-aggregate id; aggregate ids flow through
  // changedAggFiat only (spec §4, §3.1).
  const changedFiatById: Record<ITokenKey, ITokenFiat> = {};
  for (const key of allListIds) {
    if (!isAgg(key, metaPatch[key])) {
      const fiat = tokenListMap[key];
      if (fiat) {
        changedFiatById[key] = fiat;
      }
    }
  }

  const valuation: IValuationFrame = {
    changedFiatById,
    changedAggFiat,
    storeData,
    ownerKey,
  };

  // --- structure-change detection (spec §4.1) ------------------------------
  const ownerChanged = ownerKey !== prev.structure.ownerKey;
  const orderedChanged = !shallowEqualArrayOf(
    orderedIds,
    prev.structure.orderedIds,
  );
  const smallChanged = !shallowEqualArrayOf(
    smallBalanceIds,
    prev.structure.smallBalanceIds,
  );
  const nonZeroChanged = !shallowEqualArrayOf(
    nonZeroIds,
    prev.structure.nonZeroIds,
  );
  // `fundedIds` can move INDEPENDENTLY of `nonZeroIds` (e.g. a keepDefault
  // zero-balance token — already in nonZeroIds — gains a positive balance and
  // joins fundedIds without changing nonZeroIds), so it is its own structure
  // trigger to keep the atom's fundedIds correct.
  const fundedChanged = !shallowEqualArrayOf(
    fundedIds,
    prev.structure.fundedIds,
  );
  const membershipChanged = !aggMembershipEqual(
    aggMembership,
    prev.structure.aggMembership,
  );
  // The owned aggregate `{ tokens }` list-map moves in lockstep with
  // `aggMembership` in the common case, but a sub-token swap that keeps the same
  // member networks would NOT flip `membershipChanged`. Guard it independently so
  // the cell-path leaves always see the current sub-token list (full-delete PR-7).
  const aggregateListMapChanged = !aggregateListMapEqual(
    ownedAggregateTokenListMap,
    prev.structure.ownedAggregateTokenListMap,
  );
  const scalarChanged = smallBalanceFiatValue !== prev.smallBalanceFiatValue;
  const metaChanged = allTokens.some(
    (t) => !metaEqual(prev.metaByKey[t.$key], metaPatch[t.$key]),
  );

  const structuralChange =
    ownerChanged ||
    orderedChanged ||
    smallChanged ||
    nonZeroChanged ||
    fundedChanged ||
    membershipChanged ||
    aggregateListMapChanged ||
    scalarChanged ||
    metaChanged;

  if (!structuralChange) {
    // pure price tick — valuation only (spec §4.1).
    return { valuation };
  }

  const structure: IStructureSnapshot = {
    orderedIds,
    smallBalanceIds,
    nonZeroIds,
    fundedIds,
    metaPatch,
    aggMembership,
    smallBalanceFiatValue,
    ownedAggregateTokenListMap,
    storeData,
    ownerKey,
    generation: nextGeneration(prev.structure.generation, ownerChanged),
  };

  return { structure, valuation };
}

/**
 * Helper used by the producer to read the `IBuildFramesPrev.metaByKey` snapshot
 * back out of a tokens array — keeps the meta-change detection input explicit
 * and testable. Maps `$key -> IToken` (stripping `$key`).
 */
export function metaByKeyFromTokens(
  tokens: IAccountToken[],
): Record<ITokenKey, IToken> {
  const out: Record<ITokenKey, IToken> = {};
  for (const token of tokens) {
    const { $key, ...rest } = token;
    out[$key] = rest;
  }
  return out;
}
