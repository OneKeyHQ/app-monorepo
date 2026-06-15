/**
 * TokenList SLC — buildFrames PURE MAPPING (spec §4.1, §11.5).
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
import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IAccountToken,
  IToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { isAgg, metaEqual, shallowEqualArrayOf } from './pure';

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
  smallBalanceFiatValue: string;
  ownerKey: string;
  /** identity check payload (NOT a string id) — see resolveCurrentStore. */
  storeData: IJotaiContextStoreData;
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
    | 'aggMembership'
    | 'ownerKey'
    | 'generation'
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
    smallBalanceFiatValue,
    ownerKey,
    storeData,
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

  // --- nonZeroIds (Phase-1 dead-weight, see spec §8#2) ---------------------
  // Computed off balance only here; the keepDefault/custom branches are the
  // view's responsibility in Phase-1 and the result has no consumer yet. We
  // still emit it so the structure atom carries it for Phase-2 wiring.
  const nonZeroIds: ITokenKey[] = [...orderedIds, ...smallBalanceIds].filter(
    (key) => {
      const fiat = isAgg(key, metaPatch[key]) ? undefined : tokenListMap[key];
      const bal = Number(fiat?.balance ?? 0);
      return Number.isFinite(bal) && bal > 0;
    },
  );

  // --- valuation: normal token fiat ---------------------------------------
  // Full current fiat for every NON-aggregate id; aggregate ids flow through
  // changedAggFiat only (spec §4, §3.1).
  const changedFiatById: Record<ITokenKey, ITokenFiat> = {};
  for (const key of [...orderedIds, ...smallBalanceIds]) {
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
  const membershipChanged = !aggMembershipEqual(
    aggMembership,
    prev.structure.aggMembership,
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
    membershipChanged ||
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
    metaPatch,
    aggMembership,
    smallBalanceFiatValue,
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
