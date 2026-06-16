/**
 * TokenList cells — APPLY CONTRACT (spec §4, §11.2).
 *
 * The single write path for the structure atom + the per-key cells. The
 * producer (TokenListBlock, Phase-1) derives a structure frame + a valuation
 * frame from one fetch response and calls these two functions; the guards make
 * the unchanged parts no-op (spec §4.1).
 *
 * Testability (spec §11.5): every function takes the target `store`, its
 * `projection`, the wire `frame`, and an injected `deps` bag — NO module
 * globals, NO appEventBus, NO native. `deps.get/set` are the only jotai touch
 * points (bound to a node `createStore()` in tests, the live store in prod),
 * so these run with no React. The cell/meta/subcell/aggCell builders are
 * injected too; they mutate the SAME projection passed in (they resolve it via
 * the per-store WeakMap which the producer/tests seed with this projection).
 */
import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IAggKey,
  IListStructure,
  INetworkId,
  IStructureSnapshot,
  ITokenKey,
  IValuationFrame,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/types';
import type {
  IAccountToken,
  IToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import type { IStoreProjection } from './projection';
import type { IJotaiContextStore } from '../../../utils/createJotaiContext';
import type { Atom, PrimitiveAtom } from 'jotai';

/**
 * Shallow array equality used to keep `orderedIds` reference-stable when a
 * structure frame carries identical content (spec §4 "FlatList 引用稳定",
 * §11.2). Same length + same element-by-element identity.
 */
export function shallowEqualArray(a: string[], b: string[]): boolean {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

/** Runtime value stored in `listStructureAtom` (spec §3, = IListStructure). */
export type IListStructureValue = IListStructure;

/** Runtime value stored in `riskyListFrameAtom` (design §R0). */
export interface IRiskyListFrameValue {
  riskyTokens: IAccountToken[];
  riskyMap: Record<ITokenKey, ITokenFiat>;
  ownerKey: string;
}

/**
 * Injected dependency bag (spec §11.2, §11.5). Equality / summation / identity
 * logic, the jotai store accessors, the `listStructureAtom` instance, and the
 * lazy cell builders are all passed in so the apply layer never reaches for a
 * module global.
 */
export interface IApplyDeps {
  resolveCurrentStore: (
    storeData: IJotaiContextStoreData,
  ) => IJotaiContextStore | undefined;
  fiatEqual: (a?: ITokenFiat, b?: ITokenFiat) => boolean;
  metaEqual: (a?: IToken, b?: IToken) => boolean;
  isAgg: (key: string, metaOf?: IToken) => boolean;
  clearAll: (projection: IStoreProjection) => void;
  shallowEqual: (a: string[], b: string[]) => boolean;
  /** the per-store `listStructureAtom` instance (contextAtom()-resolved). */
  listStructureAtom: PrimitiveAtom<IListStructureValue>;
  /**
   * the per-store `riskyListFrameAtom` instance (design §R0). The single landing
   * spot for the BG risky frame, written by `applyRiskyFrame`. OPTIONAL: only the
   * receive-shell producer drives the risky path, so callers that never call
   * `applyRiskyFrame` (cold-start hydrate, tests) may omit it.
   */
  riskyListFrameAtom?: PrimitiveAtom<IRiskyListFrameValue>;
  /** lazy meta cell builder — same `$key` returns the same atom. */
  meta: (
    store: IJotaiContextStore,
    key: ITokenKey,
  ) => PrimitiveAtom<IToken | undefined>;
  /** lazy fiat cell builder. */
  cell: (
    store: IJotaiContextStore,
    key: ITokenKey,
  ) => PrimitiveAtom<ITokenFiat | undefined>;
  /** lazy aggregate per-network sub-cell builder. */
  subcell: (
    store: IJotaiContextStore,
    aggKey: IAggKey,
    net: INetworkId,
  ) => PrimitiveAtom<ITokenFiat | undefined>;
  /** lazy derived aggregate cell builder (NOT rebuilt on membership change). */
  aggCell: (
    store: IJotaiContextStore,
    aggKey: IAggKey,
  ) => Atom<ITokenFiat | undefined>;
  /** store read — `store.get`. */
  get: <Value>(atom: Atom<Value>) => Value;
  /** store write — `store.set`. */
  set: <Value>(atom: PrimitiveAtom<Value>, value: Value) => void;
}

/**
 * Bind the live deps from the cells modules (spec §11.5). The producer captures
 * `store` (the contextAtom store) up front, then calls this once per apply to
 * get a deps bag whose `get/set` are bound to that store. Tests construct their
 * own deps bag against a node `createStore()` instead.
 */
export function buildApplyDeps(params: {
  store: IJotaiContextStore;
  listStructureAtom: PrimitiveAtom<IListStructure>;
  riskyListFrameAtom?: PrimitiveAtom<IRiskyListFrameValue>;
  resolveCurrentStore: IApplyDeps['resolveCurrentStore'];
  fiatEqual: IApplyDeps['fiatEqual'];
  metaEqual: IApplyDeps['metaEqual'];
  isAgg: IApplyDeps['isAgg'];
  clearAll: IApplyDeps['clearAll'];
  shallowEqual: IApplyDeps['shallowEqual'];
  meta: IApplyDeps['meta'];
  cell: IApplyDeps['cell'];
  subcell: IApplyDeps['subcell'];
  aggCell: IApplyDeps['aggCell'];
}): IApplyDeps {
  const { store } = params;
  return {
    resolveCurrentStore: params.resolveCurrentStore,
    fiatEqual: params.fiatEqual,
    metaEqual: params.metaEqual,
    isAgg: params.isAgg,
    clearAll: params.clearAll,
    shallowEqual: params.shallowEqual,
    listStructureAtom: params.listStructureAtom,
    riskyListFrameAtom: params.riskyListFrameAtom,
    meta: params.meta,
    cell: params.cell,
    subcell: params.subcell,
    aggCell: params.aggCell,
    get: (a) => store.get(a),
    set: (a, v) => store.set(a, v),
  };
}

// --- apply contract --------------------------------------------------------

/**
 * applyStructureSnapshot (spec §4). Structure frames are low-frequency; pure
 * price ticks never reach here. Order of operations is exact per spec:
 *   1. projection must exist;
 *   2. identity check (reset/recreate guard);
 *   3. owner switch -> clearAll + reset generation;
 *   4. generation guard (drop stale structure frames);
 *   5. metaPatch via metaEqual (write only when changed);
 *   6. prune fiat cells (normalKeys = {orderedIds ∪ smallBalanceIds} & !isAgg)
 *      and metas (liveKeys = {orderedIds ∪ smallBalanceIds}, incl. aggregate);
 *   7. prune aggregate by aggMembership (whole-group + per-network);
 *   8. ensure agg sub-cells + aggCell lazily (DO NOT rebuild aggCell);
 *   9. orderedIds ref-stable via shallowEqual;
 *  10. set(listStructureAtom) THEN bump curGeneration.
 */
export function applyStructureSnapshot(
  store: IJotaiContextStore,
  projection: IStoreProjection,
  snapshot: IStructureSnapshot,
  deps: IApplyDeps,
): void {
  const P = projection;
  if (!P) {
    return;
  }
  // 2. identity check (reset/recreate guard)
  if (deps.resolveCurrentStore(snapshot.storeData) !== store) {
    return;
  }
  // 3. owner switch -> full reset (incl. aggregate)
  if (snapshot.ownerKey !== P.curOwnerKey) {
    deps.clearAll(P);
    P.curOwnerKey = snapshot.ownerKey;
    P.curGeneration = -1;
  }
  // 4. generation guard — drop stale structure frames
  if (snapshot.generation <= P.curGeneration) {
    return;
  }

  // 5. metaPatch via metaEqual (write only changed)
  for (const k of Object.keys(snapshot.metaPatch)) {
    const m = snapshot.metaPatch[k];
    const metaAtom = deps.meta(store, k);
    if (!deps.metaEqual(deps.get(metaAtom), m)) {
      deps.set(metaAtom, m);
    }
  }

  // 6. prune cells/metas.
  //   - cells: only NON-aggregate fiat cells live in P.cells (aggregate rows use
  //     aggSubCells/aggCell), so prune P.cells by `normalKeys` = the live
  //     ordered/smallBalance keys with the `& !isAgg` carve-out — unchanged.
  //   - metas: aggregate ROW keys ARE present in orderedIds (TokenListBlock
  //     appends aggregate rows into the ordered list) and their meta IS written
  //     in step 5's metaPatch; the home cell path rebuilds each row from its
  //     meta cell, so an aggregate row whose meta is pruned silently vanishes.
  //     Prune metas by the FULL live-key set (`liveKeys`, incl. aggregate) so an
  //     aggregate row's meta survives as long as its key is a live ordered/
  //     smallBalance id. (Aggregate sub-cell membership is pruned independently
  //     in step 7 by aggMembership.)
  const liveKeys = new Set<ITokenKey>([
    ...snapshot.orderedIds,
    ...snapshot.smallBalanceIds,
  ]);
  const normalKeys = new Set<ITokenKey>();
  for (const k of liveKeys) {
    if (!deps.isAgg(k, deps.get(deps.meta(store, k)))) {
      normalKeys.add(k);
    }
  }
  for (const k of P.cells.keys()) {
    if (!normalKeys.has(k)) {
      P.cells.delete(k);
    }
  }
  for (const k of P.metas.keys()) {
    if (!liveKeys.has(k)) {
      P.metas.delete(k);
    }
  }

  // 7. prune aggregate by aggMembership (whole-group + per-network)
  for (const aggKey of P.aggSubCells.keys()) {
    const members = snapshot.aggMembership[aggKey];
    if (!members) {
      // whole group left
      P.aggSubCells.delete(aggKey);
      P.aggCells.delete(aggKey);
    } else {
      const memberSet = new Set(members);
      const byNet = P.aggSubCells.get(aggKey);
      if (byNet) {
        for (const netId of byNet.keys()) {
          if (!memberSet.has(netId)) {
            byNet.delete(netId);
          }
        }
      }
    }
  }

  // 8. ensure agg sub-cells + aggCell lazily (DO NOT rebuild aggCell)
  for (const aggKey of Object.keys(snapshot.aggMembership)) {
    for (const netId of snapshot.aggMembership[aggKey]) {
      deps.subcell(store, aggKey, netId);
    }
    deps.aggCell(store, aggKey);
  }

  // 8b. ensure a fiat cell exists for every live NORMAL key. The valuation
  // frame applied in the SAME round can only WRITE existing cells (orphan
  // guard); it never lazy-creates. On an owner switch the producer PULL runs
  // applyStructure (which clearAll'd every cell) → applyValuation back-to-back,
  // BEFORE any leaf has re-rendered to lazily re-create cells — so without this
  // pre-create the valuation orphan-skips EVERY key and the whole list stays at
  // "-" (worst on virtualized off-screen rows that never render a leaf, e.g.
  // BTC lower in the list) until a much later push. Mirrors step 8's agg ensure
  // and cold-start's `fanOutSlimToApply`, which pre-creates cells for the same
  // reason. `normalKeys` ⊇ the valuation's `changedFiatById` keys (both derive
  // from orderedIds ∪ smallBalanceIds minus aggregates), so this creates no
  // orphans.
  for (const k of normalKeys) {
    deps.cell(store, k);
  }

  // 9. orderedIds ref-stability via shallowEqual
  const cur = deps.get(deps.listStructureAtom);
  const orderedIds = deps.shallowEqual(snapshot.orderedIds, cur.orderedIds)
    ? cur.orderedIds
    : snapshot.orderedIds;

  // 10. set(listStructureAtom) THEN bump curGeneration. This set re-evaluates
  // every mounted aggCell (which reads aggMembership) so it picks up new
  // members (spec §3.1).
  deps.set(deps.listStructureAtom, {
    orderedIds,
    smallBalanceIds: snapshot.smallBalanceIds,
    nonZeroIds: snapshot.nonZeroIds,
    fundedIds: snapshot.fundedIds,
    aggMembership: snapshot.aggMembership,
    ownerKey: snapshot.ownerKey,
    generation: snapshot.generation,
    smallBalanceFiatValue: snapshot.smallBalanceFiatValue,
    // full-delete PR-7: the per-`$key` owned aggregate sub-token METADATA list
    // is structure-tier (changes only on a structure frame) so the home
    // cell-path leaves read it off `listStructureAtom`. Default `{}` so a
    // snapshot without the field (legacy/test) leaves a well-formed map.
    ownedAggregateTokenListMap: snapshot.ownedAggregateTokenListMap ?? {},
  });
  P.curGeneration = snapshot.generation;
}

/**
 * applyValuationFrame (spec §4). Runs on every fetch round. The frame carries
 * the FULL current fiat map (idempotent snapshot, not a delta — see
 * IValuationFrame); this per-cell write loop is what makes it effectively
 * changed-only, skipping a `set` when `fiatEqual` holds so unchanged cells never
 * notify. Guards: identity check + owner guard. NOT gated by generation, NEVER
 * lazy-builds cells (would create orphans).
 *   - changedFiatById: write ONLY existing normal cells (P.cells.has, else
 *     skip) via fiatEqual (no notification when value unchanged).
 *   - changedAggFiat: write ONLY existing per-network sub-cells; the derived
 *     aggCell recomputes automatically via jotai dep-tracking.
 *
 * `batch` is provided by the caller (React batched context in production; a
 * pass-through in node tests).
 */
export function applyValuationFrame(
  store: IJotaiContextStore,
  projection: IStoreProjection,
  frame: IValuationFrame,
  deps: IApplyDeps,
  batch: (fn: () => void) => void = (fn) => fn(),
): void {
  const P = projection;
  if (!P) {
    return;
  }
  // identity check
  if (deps.resolveCurrentStore(frame.storeData) !== store) {
    return;
  }
  // owner guard (do NOT gate by generation; do NOT lazy-build)
  if (frame.ownerKey !== P.curOwnerKey) {
    return;
  }

  batch(() => {
    // normal tokens — existing cells only (orphan guard)
    for (const k of Object.keys(frame.changedFiatById)) {
      // not in structure -> never lazy-create -> no orphan
      const cellAtom = P.cells.get(k);
      if (cellAtom) {
        const next = frame.changedFiatById[k];
        if (!deps.fiatEqual(deps.get(cellAtom), next)) {
          deps.set(cellAtom, next);
        }
      }
    }

    // aggregate per-network sub-cells — existing only; aggCell recomputes
    for (const aggKey of Object.keys(frame.changedAggFiat)) {
      const byNet = P.aggSubCells.get(aggKey);
      if (byNet) {
        const byNetPayload = frame.changedAggFiat[aggKey];
        for (const netId of Object.keys(byNetPayload)) {
          const subAtom = byNet.get(netId);
          if (subAtom) {
            const next = byNetPayload[netId];
            if (!deps.fiatEqual(deps.get(subAtom), next)) {
              deps.set(subAtom, next);
            }
          }
        }
      }
    }
  });
}

/**
 * applyRiskyFrame (design §R0). Lands the BG risky frame — a FULL idempotent
 * snapshot ({ riskyTokens, riskyMap }) — into `riskyListFrameAtom`. Guards:
 *   - identity check (reset/recreate guard, same as the other applies);
 * Version-guarding lives in the receive shell (drops stale riskyVersion before
 * calling here), so this layer just writes the current owner's snapshot. The
 * write is unconditional after the identity check: the snapshot is idempotent
 * and small (a list + map), so there is no per-cell diff here. The `ownerKey` is
 * stamped onto the atom value so a reader can confirm owner membership.
 */
export function applyRiskyFrame(
  store: IJotaiContextStore,
  frame: {
    riskyTokens: IAccountToken[];
    riskyMap: Record<ITokenKey, ITokenFiat>;
    storeData: IJotaiContextStoreData;
    ownerKey: string;
  },
  deps: IApplyDeps,
): void {
  // identity check (reset/recreate guard)
  if (deps.resolveCurrentStore(frame.storeData) !== store) {
    return;
  }
  const { riskyListFrameAtom } = deps;
  if (!riskyListFrameAtom) {
    return;
  }
  deps.set(riskyListFrameAtom, {
    riskyTokens: frame.riskyTokens,
    riskyMap: frame.riskyMap,
    ownerKey: frame.ownerKey,
  });
}
