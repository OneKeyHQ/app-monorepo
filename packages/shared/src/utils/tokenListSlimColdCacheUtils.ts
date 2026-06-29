/**
 * TokenList cells — COLD START pure functions (spec §7, §11.1).
 *
 * Every function here is pure (explicit inputs, no React / native / jotai /
 * global access) so it is node-jest testable (spec §11, §11.5). They build /
 * gate / purge the slim cold-start bundle that the cells writes to a NEW,
 * physically-distinct cache key (`ctx:tokenListSlimColdCache`) — never the old
 * `ctx:renderedTokenListCacheAtom` (spec §7, §2).
 *
 * "运行时拆、磁盘合" (spec §7): the runtime keeps ids (listStructureAtom) and
 * values (cells) in separate atoms for fine-grained renders, but the DISK
 * snapshot packs the ids AND values (compactFiat / compactAggFiat / compactMeta)
 * into ONE bundle — so a cold start hydrates rows + price + name/icon in a
 * single T0 paint.
 */
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '../consts/jotaiConsts';

import type { IAccountToken, IToken, ITokenFiat } from '../../types/token';

/** `$key` alias — a token's stable list key. */
export type ITokenKey = string;
/** aggregate-token list-map key (e.g. `aggregate_...`). */
export type IAggKey = string;
export type INetworkId = string;

/**
 * The slim per-key fiat projection persisted on disk (spec §7). Only the
 * render-/currency-relevant fields are kept so the bundle stays small (1MB cap
 * is enforced by the snapshot writer, not here).
 */
export interface ICompactFiat {
  balanceParsed: string;
  fiatValue: string;
  price: number;
  price24h?: number;
  currency?: string;
}

/**
 * The runtime structure shape `buildSlimSnapshot` consumes. Mirrors
 * `IListStructure` (kit/.../cells/types) but is duplicated here as a plain shape
 * so the shared package stays free of any kit import (import hierarchy:
 * shared MUST NOT import from kit).
 */
export interface ISlimSnapshotStructure {
  orderedIds: ITokenKey[];
  smallBalanceIds: ITokenKey[];
  aggMembership: Record<IAggKey, INetworkId[]>;
  ownerKey: string;
  generation: number;
  /**
   * hideZero VIEW-filter membership (keepDefault zero-balance kept). Optional so
   * OLDER bundles parse; absent -> restored as `[]`. Persisting it lets a
   * hideZero cold start paint the kept set at T0 instead of being filtered to
   * the empty placeholder until the first real frame (the original cold-start
   * "empty list" bug).
   */
  nonZeroIds?: ITokenKey[];
  /**
   * STRICT funded set (balance>0, agg-aware) — drives `hasHoldingsNow`. Optional
   * for back-compat; absent -> restored as `[]`.
   */
  fundedIds?: ITokenKey[];
  /**
   * §6 small-balance fiat scalar. Optional on the wire so OLDER persisted slim
   * bundles (written before PR-0) still parse; absent -> restored as '0'.
   */
  smallBalanceFiatValue?: string;
  /**
   * Per-`$key` OWNED aggregate sub-token METADATA list (`{ tokens }`). Optional
   * so OLDER bundles (pre-PR-7) still parse; absent -> restored as `{}` (cold
   * aggregate badges fill on the first real structure frame).
   */
  ownedAggregateTokenListMap?: Record<IAggKey, { tokens: IAccountToken[] }>;
}

/**
 * The slim cold-start bundle (spec §7). Packs the ids AND the per-key values
 * (incl. aggregate per-network sub-values) so a cold start paints rows + price
 * + name/icon at T0. `currency` gates re-use (spec §3#3, shouldUseSlim).
 */
export interface ITokenListSlimColdCache {
  orderedIds: ITokenKey[];
  smallBalanceIds: ITokenKey[];
  aggMembership: Record<IAggKey, INetworkId[]>;
  /** $key -> compact fiat (normal tokens). */
  compactFiat: Record<ITokenKey, ICompactFiat>;
  /** aggKey -> networkId -> compact fiat (aggregate per-network sub-values). */
  compactAggFiat: Record<IAggKey, Record<INetworkId, ICompactFiat>>;
  /** $key -> minimal meta required to render the row. */
  compactMeta: Record<ITokenKey, IToken>;
  gen: number;
  ownerKey: string;
  /** currency id the compact fiat values are stored in (gate, spec §3#3). */
  currency: string;
  /**
   * hideZero VIEW-filter membership persisted so a hideZero cold start paints
   * the kept set at T0 instead of an empty list. Optional so older bundles
   * parse; absent -> restored as `[]`.
   */
  nonZeroIds?: ITokenKey[];
  /**
   * STRICT funded set (balance>0) persisted so `hasHoldingsNow` is correct at
   * T0. Optional for back-compat; absent -> restored as `[]`.
   */
  fundedIds?: ITokenKey[];
  /**
   * §6 small-balance fiat scalar persisted so a cold start restores the REAL
   * value (not a hardcoded '0'). Optional so older bundles (pre-PR-0) parse;
   * absent -> restored as '0' (PR-0 enabler).
   */
  smallBalanceFiatValue?: string;
  /**
   * Per-`$key` OWNED aggregate sub-token METADATA list (`{ tokens }`) persisted
   * so a cold start paints aggregate badges/sub-token lists at T0 (full-delete
   * PR-7). Optional so older bundles parse; absent -> restored as `{}`.
   */
  ownedAggregateTokenListMap?: Record<IAggKey, { tokens: IAccountToken[] }>;
}

/**
 * Physically-distinct cache key for the slim bundle (spec §2, §7). MUST be
 * different from `ctx:renderedTokenListCacheAtom` so the new and old formats
 * never ping-pong into the same MMKV/IDB slot.
 */
export const TOKEN_LIST_SLIM_COLD_CACHE_KEY =
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.tokenListSlimColdCacheAtom;

/**
 * One-time-cleanup VERSION FLAG (spec §7, §4 of the task). NOT a once-ever bool
 * — a monotonically-increasing integer the app compares against the persisted
 * `tokenColdStartCleanupVersion` so a downgrade→upgrade still re-runs cleanup
 * (the persisted value would be < N again only if a newer build bumps it).
 */
export const TOKEN_COLD_START_CLEANUP_VERSION = 1;

/**
 * The OLD cold-start cache key whose fields must be purged once (spec §7).
 * The on-disk snapshot scopes keys as `${scope}::${cacheKey}` (kit-bg
 * COLD_START_SCOPED_KEY_SEPARATOR = '::'), so the prefix to match is
 * `::ctx:renderedTokenListCacheAtom` — i.e. any scoped key ENDING in the old
 * cache key. We match by suffix on that scoped form (spec §7 "正确前缀
 * `::ctx:renderedTokenListCacheAtom`").
 */
export const OLD_RENDERED_TOKEN_LIST_CACHE_SCOPED_SUFFIX = `::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.renderedTokenListCacheAtom}`;

/**
 * Project a full `ITokenFiat` down to the slim `ICompactFiat` kept on disk.
 * Only the render-/currency-relevant fields survive (spec §7 slim bundle).
 */
function toCompactFiat(fiat: ITokenFiat): ICompactFiat {
  const compact: ICompactFiat = {
    balanceParsed: fiat.balanceParsed,
    fiatValue: fiat.fiatValue,
    price: fiat.price,
  };
  if (fiat.price24h !== undefined) {
    compact.price24h = fiat.price24h;
  }
  if (fiat.currency !== undefined) {
    compact.currency = fiat.currency;
  }
  return compact;
}

export interface IBuildSlimSnapshotParams {
  structure: ISlimSnapshotStructure;
  /** $key -> ITokenFiat (normal token cells, read from the runtime cells). */
  fiatByKey: Record<ITokenKey, ITokenFiat | undefined>;
  /** aggKey -> networkId -> ITokenFiat (aggregate per-network sub-cells). */
  aggFiatByKey: Record<IAggKey, Record<INetworkId, ITokenFiat | undefined>>;
  /** $key -> IToken (meta cells). */
  metaByKey: Record<ITokenKey, IToken | undefined>;
  /** the currency id the runtime fiat values are currently stored in. */
  currency: string;
}

/**
 * buildSlimSnapshot (spec §7, §11.1). Flattens the runtime structure + cell
 * values into ONE slim bundle for disk. Pure: it reads the explicitly-passed
 * maps (no cell/atom access) and writes only compact projections.
 *
 * - `compactFiat` covers every NON-aggregate ordered/smallBalance id that has a
 *   fiat value (aggregate ids flow through `compactAggFiat` only).
 * - `compactAggFiat` covers the aggregate per-network sub-values from
 *   `aggMembership` so an aggregate row has a price at T0.
 * - `compactMeta` keeps the row-render meta for every ordered/smallBalance id
 *   that has a meta entry.
 */
export function buildSlimSnapshot(
  params: IBuildSlimSnapshotParams,
): ITokenListSlimColdCache {
  const { structure, fiatByKey, aggFiatByKey, metaByKey, currency } = params;

  const allIds = [...structure.orderedIds, ...structure.smallBalanceIds];
  const aggKeySet = new Set<IAggKey>(Object.keys(structure.aggMembership));

  const compactFiat: Record<ITokenKey, ICompactFiat> = {};
  const compactMeta: Record<ITokenKey, IToken> = {};
  for (const key of allIds) {
    const m = metaByKey[key];
    if (m) {
      compactMeta[key] = m;
    }
    // aggregate ids do not get a normal compactFiat entry — their values live
    // in compactAggFiat (per-network). Only non-aggregate ids land here.
    if (!aggKeySet.has(key)) {
      const fiat = fiatByKey[key];
      if (fiat) {
        compactFiat[key] = toCompactFiat(fiat);
      }
    }
  }

  const compactAggFiat: Record<IAggKey, Record<INetworkId, ICompactFiat>> = {};
  for (const aggKey of Object.keys(structure.aggMembership)) {
    const byNet = aggFiatByKey[aggKey];
    if (byNet) {
      const members = structure.aggMembership[aggKey];
      const outByNet: Record<INetworkId, ICompactFiat> = {};
      for (const net of members) {
        const fiat = byNet[net];
        if (fiat) {
          outByNet[net] = toCompactFiat(fiat);
        }
      }
      if (Object.keys(outByNet).length > 0) {
        compactAggFiat[aggKey] = outByNet;
      }
    }
  }

  return {
    orderedIds: structure.orderedIds,
    smallBalanceIds: structure.smallBalanceIds,
    aggMembership: structure.aggMembership,
    compactFiat,
    compactAggFiat,
    compactMeta,
    gen: structure.generation,
    ownerKey: structure.ownerKey,
    currency,
    nonZeroIds: structure.nonZeroIds ?? [],
    fundedIds: structure.fundedIds ?? [],
    smallBalanceFiatValue: structure.smallBalanceFiatValue ?? '0',
    ownedAggregateTokenListMap: structure.ownedAggregateTokenListMap ?? {},
  };
}

/**
 * shouldUseSlim (spec §3#3, §7, §11.1). The slim bundle may only be painted at
 * T0 when its stored `currency` matches the current settings currency —
 * otherwise the cached fiat values are in a stale currency and would paint a
 * wrong number (the runtime would re-fetch and overwrite shortly after, but the
 * brief wrong paint is unacceptable). On mismatch the cache is treated as a
 * miss (no paint). An absent/empty bundle is never usable.
 */
export function shouldUseSlim(
  slim: ITokenListSlimColdCache | undefined | null,
  currentCurrency: string,
): boolean {
  if (!slim) {
    return false;
  }
  if (!slim.currency || !currentCurrency) {
    return false;
  }
  return slim.currency === currentCurrency;
}

/**
 * purgeOldColdStartFields (spec §7, §11.1). Removes every field whose scoped
 * key carries the OLD `ctx:renderedTokenListCacheAtom` cache key (matched by
 * the `::ctx:renderedTokenListCacheAtom` suffix on the scoped form). Pure: it
 * shallow-copies the snapshot object and deletes the matching keys; the NEW
 * slim key (`ctx:tokenListSlimColdCache`) is NOT matched by the suffix and is
 * therefore never deleted (spec §7 "确保不误删新 key").
 *
 * Returns a NEW object (does not mutate the input) so callers can diff or keep
 * the original.
 */
export function purgeOldColdStartFields(
  snapshotObj: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const key of Object.keys(snapshotObj)) {
    if (!key.endsWith(OLD_RENDERED_TOKEN_LIST_CACHE_SCOPED_SUFFIX)) {
      next[key] = snapshotObj[key];
    }
  }
  return next;
}
