/**
 * TokenList cells — Phase-1 STATE SHELL (spec §3, §3.1).
 *
 * The per-store projection registry + lazy cell builders. This is the "底座"
 * that the stable `useTokenFiat($key)` seam reads from. Producer/leaf wiring is
 * NOT done here (that is a later slice) — this module only stands up the cells,
 * the derived aggregate cell, and the identity helpers.
 *
 * SINGLE WeakMap value shape only (spec §3, §42: the three legacy variants are
 * void). Cells are GC'd with their store (single-writer makes this enough; no
 * precise reset timing dependency).
 */
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { atom } from 'jotai';

import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { sumAggregateEntry } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/pure';
import type {
  IAggKey,
  INetworkId,
  ITokenKey,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/types';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { jotaiContextStore } from '../../../utils/jotaiContextStore';
import { listStructureAtom } from '../atoms';

import type { IJotaiContextStore } from '../../../utils/createJotaiContext';
import type { Atom, PrimitiveAtom } from 'jotai';

/**
 * The single authoritative per-store projection value shape (spec §3).
 */
export interface IStoreProjection {
  /** normal token fiat cells. */
  cells: Map<ITokenKey, PrimitiveAtom<ITokenFiat | undefined>>;
  /** normal token meta cells. */
  metas: Map<ITokenKey, PrimitiveAtom<IToken | undefined>>;
  /** aggregate per-network sub-cells (one writer per network tick, spec §3.1). */
  aggSubCells: Map<
    IAggKey,
    Map<INetworkId, PrimitiveAtom<ITokenFiat | undefined>>
  >;
  /** aggregate DERIVED read-only cells (sum of sub-cells, spec §3.1). */
  aggCells: Map<IAggKey, Atom<ITokenFiat | undefined>>;
  curOwnerKey: string | undefined;
  /** generation of the most recent applyStructure. */
  curGeneration: number;
}

/**
 * One WeakMap, keyed by store. Entries are reclaimed when the store is GC'd.
 */
const storeProjection: WeakMap<IJotaiContextStore, IStoreProjection> =
  new WeakMap();

/**
 * Get-or-create the projection for a store. Producer/apply paths create the
 * projection eagerly; the lazy builders below also ensure it exists so leaves
 * reading a cell never hit an undefined registry.
 */
export function ensureStoreProjection(
  store: IJotaiContextStore,
): IStoreProjection {
  let p = storeProjection.get(store);
  if (!p) {
    p = {
      cells: new Map(),
      metas: new Map(),
      aggSubCells: new Map(),
      aggCells: new Map(),
      curOwnerKey: undefined,
      curGeneration: -1,
    };
    storeProjection.set(store, p);
  }
  return p;
}

export function getStoreProjection(
  store: IJotaiContextStore,
): IStoreProjection | undefined {
  return storeProjection.get(store);
}

/**
 * Identity resolver (spec §4.0, §4). Wraps `jotaiContextStore.getStore`; the
 * input is `IJotaiContextStoreData` (NOT a string id — there is no
 * `getStore(id: string)` overload). Used by apply to verify the captured
 * target store still matches before mutating cells (reset/recreate guard).
 */
export function resolveCurrentStore(
  storeData: IJotaiContextStoreData,
): IJotaiContextStore | undefined {
  return jotaiContextStore.getStore(storeData);
}

/**
 * Recover the `IJotaiContextStoreData` for a live store (producer-side, spec
 * §4.0). The store stamps `__ONEKEY_JOTAI_COLD_START_SCOPE_KEY__ = store:<id>`
 * at creation (jotaiContextStore.ts). For the token-list stores the id has no
 * accountSelectorInfo, so `id === storeName` and `{ storeName: id }` round-trips
 * through `resolveCurrentStore` (= getStore -> buildJotaiContextStoreId ->
 * cache). Returns undefined when the stamp is absent (e.g. a bare node
 * createStore in tests, which inject their own resolveCurrentStore instead).
 */
export function resolveStoreData(
  store: IJotaiContextStore,
): IJotaiContextStoreData | undefined {
  const scopeKey = (
    store as IJotaiContextStore & {
      __ONEKEY_JOTAI_COLD_START_SCOPE_KEY__?: string;
    }
  ).__ONEKEY_JOTAI_COLD_START_SCOPE_KEY__;
  if (!scopeKey) {
    return undefined;
  }
  const id = scopeKey.startsWith('store:')
    ? scopeKey.slice('store:'.length)
    : scopeKey;
  // token-list stores carry no accountSelectorInfo, so storeName === id.
  return { storeName: id } as IJotaiContextStoreData;
}

// --- lazy cell builders (spec §3) -----------------------------------------

/**
 * Lazy normal-token fiat cell. Same `$key` returns the same atom instance.
 */
export function cell(
  store: IJotaiContextStore,
  key: ITokenKey,
): PrimitiveAtom<ITokenFiat | undefined> {
  const p = ensureStoreProjection(store);
  let a = p.cells.get(key);
  if (!a) {
    a = atom<ITokenFiat | undefined>(undefined);
    p.cells.set(key, a);
  }
  return a;
}

/**
 * Lazy normal-token meta cell. Same `$key` returns the same atom instance.
 */
export function meta(
  store: IJotaiContextStore,
  key: ITokenKey,
): PrimitiveAtom<IToken | undefined> {
  const p = ensureStoreProjection(store);
  let a = p.metas.get(key);
  if (!a) {
    a = atom<IToken | undefined>(undefined);
    p.metas.set(key, a);
  }
  return a;
}

/**
 * Lazy aggregate per-network sub-cell (spec §4.0 subcell). Same (aggKey,net)
 * returns the same atom instance.
 */
export function subcell(
  store: IJotaiContextStore,
  aggKey: IAggKey,
  net: INetworkId,
): PrimitiveAtom<ITokenFiat | undefined> {
  const p = ensureStoreProjection(store);
  let byNet = p.aggSubCells.get(aggKey);
  if (!byNet) {
    byNet = new Map();
    p.aggSubCells.set(aggKey, byNet);
  }
  let a = byNet.get(net);
  if (!a) {
    a = atom<ITokenFiat | undefined>(undefined);
    byNet.set(net, a);
  }
  return a;
}

/**
 * Lazy aggregate DERIVED cell (spec §3.1). MUST NOT be a primitive and MUST
 * NOT be rebuilt on membership change: it reads members from
 * `listStructureAtom.aggMembership[aggKey]` then sums the corresponding
 * sub-cells. Because jotai re-tracks deps on every eval, a membership change
 * (structure frame) makes this cell re-evaluate and `get` the new sub-cells —
 * no atom rebuild, no stale subscription, no leaf resubscribe.
 */
export function aggCell(
  store: IJotaiContextStore,
  aggKey: IAggKey,
): Atom<ITokenFiat | undefined> {
  const p = ensureStoreProjection(store);
  let a = p.aggCells.get(aggKey);
  if (!a) {
    a = atom<ITokenFiat | undefined>((get) => {
      const members = get(listStructureAtom()).aggMembership[aggKey] ?? [];
      return sumAggregateEntry(
        members.map((net) => get(subcell(store, aggKey, net))),
      );
    });
    p.aggCells.set(aggKey, a);
  }
  return a;
}

/**
 * clearAll (spec §4.0): reset the whole projection on owner switch /
 * reset-recreate. Clears cells/metas/aggSubCells/aggCells and resets the owner
 * stamp + generation.
 */
export function clearAll(p: IStoreProjection): void {
  p.cells.clear();
  p.metas.clear();
  p.aggSubCells.clear();
  p.aggCells.clear();
  p.curOwnerKey = undefined;
  p.curGeneration = -1;
}
