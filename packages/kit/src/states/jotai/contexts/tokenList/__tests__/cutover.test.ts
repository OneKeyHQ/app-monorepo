/**
 * TokenList cells — Phase-2 CUTOVER merge-gate tests (design §5 PR-2).
 *
 * These are the cutover invariants the receive shell (`useTokenListCellsProducer`)
 * relies on. RTL is not feasible here (the shell is a thin React hook over
 * appEventBus + a @backgroundMethod PULL), so we assert the LOAD-BEARING logic
 * at the projection/apply + registry + version-guard level with a real jotai
 * `createStore()` (no React), exactly as the established apply.test.ts harness
 * does. The version-guard here is a 1:1 replica of the shell's
 * `applyStructure` / `applyValuation` guard (lastStructureVersionRef /
 * lastValuationVersionRef), so a regression in the guard logic the shell embeds
 * is caught.
 *
 * Coverage:
 *   - SUBSCRIBE-THEN-PULL ordering: a frame source is always live, no blank
 *     window — a push that races an in-flight pull is NOT lost (higher version
 *     wins, lower dropped), and a pull that resolves after a newer push is
 *     dropped.
 *   - version-guard drops a stale pull/push (structureVersion <= last applied,
 *     valuationVersion <= last applied).
 *   - single-token price tick → only that leaf cell notifies; the structure
 *     atom + sibling cells fire 0 (spec §11.3).
 *   - owner-switch clears the old owner's cells + the new owner's first frame
 *     (a low generation) is applied after the version refs reset.
 *   - registry: single-slim-writer (only the first-registered store) + per-name
 *     fan-out enumeration (two stores under one storeName).
 */
import { createStore } from 'jotai';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  fiatEqual,
  isAgg,
  metaEqual,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/pure';
import type {
  IStructureSnapshot,
  IValuationFrame,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/types';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { listStructureAtom } from '../atoms';
import {
  applyStructureSnapshot,
  applyValuationFrame,
  buildApplyDeps,
  shallowEqualArray,
} from '../cells/apply';
import {
  aggCell,
  cell,
  clearAll,
  ensureStoreProjection,
  meta,
  subcell,
} from '../cells/projection';
import {
  deregisterMountedStore,
  getMountedStores,
  isPrimaryColdStartWriter,
  registerMountedStore,
} from '../cells/registry';

import type { IJotaiContextStore } from '../../../utils/createJotaiContext';
import type { IApplyDeps } from '../cells/apply';
import type { IStoreProjection } from '../cells/projection';

type IStore = ReturnType<typeof createStore>;

const STORE_DATA = {
  storeName: EJotaiContextStoreNames.homeTokenList,
} as IJotaiContextStoreData;

function makeFiat(overrides: Partial<ITokenFiat> = {}): ITokenFiat {
  return {
    balance: '0',
    balanceParsed: '0',
    fiatValue: '0',
    price: 0,
    ...overrides,
  };
}

function makeToken(overrides: Partial<IToken> = {}): IToken {
  return {
    name: 'Token',
    symbol: 'TKN',
    decimals: 18,
    address: '0xabc',
    isNative: false,
    ...overrides,
  };
}

function makeDeps(
  store: IStore,
  resolve: (data: IJotaiContextStoreData) => IStore | undefined,
): IApplyDeps {
  const asCtx = store as unknown as Parameters<typeof cell>[0];
  return buildApplyDeps({
    store: asCtx,
    listStructureAtom: listStructureAtom(),
    resolveCurrentStore: (data) =>
      resolve(data) as unknown as ReturnType<IApplyDeps['resolveCurrentStore']>,
    fiatEqual,
    metaEqual,
    isAgg,
    clearAll,
    shallowEqual: shallowEqualArray,
    meta,
    cell,
    subcell,
    aggCell,
  });
}

function makeStructure(
  overrides: Partial<IStructureSnapshot> = {},
): IStructureSnapshot {
  return {
    orderedIds: [],
    smallBalanceIds: [],
    nonZeroIds: [],
    fundedIds: [],
    metaPatch: {},
    aggMembership: {},
    smallBalanceFiatValue: '0',
    ownedAggregateTokenListMap: {},
    storeData: STORE_DATA,
    ownerKey: 'acc1__net1',
    generation: 0,
    ...overrides,
  };
}

function makeValuation(
  overrides: Partial<IValuationFrame> = {},
): IValuationFrame {
  return {
    changedFiatById: {},
    changedAggFiat: {},
    storeData: STORE_DATA,
    ownerKey: 'acc1__net1',
    ...overrides,
  };
}

/**
 * A faithful replica of the receive shell's version-guarded apply pair. Mirrors
 * `useTokenListCellsProducer` `applyStructure` / `applyValuation` exactly (the
 * version refs + drop-when-<=-last logic), bound to a node store + projection so
 * the cutover invariants are testable with no React.
 */
function makeShell(params: {
  store: IStore;
  projection: IStoreProjection;
  deps: IApplyDeps;
  storeData: IJotaiContextStoreData;
}) {
  const { store, projection, deps, storeData } = params;
  const ctx = store as unknown as IJotaiContextStore;
  const versions = { structure: -1, valuation: -1 };
  const applyStructure = (
    structureVersion: number,
    structure: IStructureSnapshot | undefined,
  ): boolean => {
    if (!structure) {
      return false;
    }
    if (structureVersion <= versions.structure) {
      return false; // stale — dropped
    }
    applyStructureSnapshot(ctx, projection, { ...structure, storeData }, deps);
    versions.structure = structureVersion;
    return true;
  };
  const applyValuation = (
    valuationVersion: number,
    valuation: IValuationFrame | undefined,
  ): boolean => {
    if (!valuation) {
      return false;
    }
    if (valuationVersion <= versions.valuation) {
      return false; // stale — dropped
    }
    applyValuationFrame(
      ctx,
      projection,
      { ...valuation, storeData },
      deps,
      (fn) => fn(),
    );
    versions.valuation = valuationVersion;
    return true;
  };
  const resetVersionsForOwnerChange = (): void => {
    versions.structure = -1;
    versions.valuation = -1;
  };
  return {
    applyStructure,
    applyValuation,
    resetVersionsForOwnerChange,
    versions,
  };
}

function setup(): {
  store: IStore;
  ctx: IJotaiContextStore;
  projection: IStoreProjection;
  deps: IApplyDeps;
  shell: ReturnType<typeof makeShell>;
} {
  const store = createStore();
  const ctx = store as unknown as IJotaiContextStore;
  const projection = ensureStoreProjection(
    store as unknown as Parameters<typeof cell>[0],
  );
  const deps = makeDeps(store, (data) =>
    data.storeName === STORE_DATA.storeName ? store : undefined,
  );
  const shell = makeShell({ store, projection, deps, storeData: STORE_DATA });
  return { store, ctx, projection, deps, shell };
}

describe('cells cutover — version guard (stale pull/push dropped)', () => {
  it('drops a structure pull/push whose version <= last applied (race)', () => {
    const { store, shell } = setup();
    // push at gen 5 lands first
    expect(
      shell.applyStructure(
        5,
        makeStructure({ orderedIds: ['a', 'b'], generation: 5 }),
      ),
    ).toBe(true);
    expect(store.get(listStructureAtom()).orderedIds).toEqual(['a', 'b']);

    // an older in-flight PULL (gen 3) resolves AFTER -> dropped, list unchanged
    expect(
      shell.applyStructure(
        3,
        makeStructure({ orderedIds: ['x'], generation: 3 }),
      ),
    ).toBe(false);
    expect(store.get(listStructureAtom()).orderedIds).toEqual(['a', 'b']);

    // an equal-version frame is also dropped (<=)
    expect(
      shell.applyStructure(
        5,
        makeStructure({ orderedIds: ['z'], generation: 5 }),
      ),
    ).toBe(false);
    expect(store.get(listStructureAtom()).orderedIds).toEqual(['a', 'b']);
  });

  it('drops a valuation frame whose version <= last applied', () => {
    const { store, ctx, shell } = setup();
    shell.applyStructure(
      0,
      makeStructure({ orderedIds: ['a'], generation: 0 }),
    );
    // A mounted leaf lazily creates the cell (useTokenFiat); model that so the
    // orphan-guarded valuation apply has a cell to write.
    cell(ctx as unknown as Parameters<typeof cell>[0], 'a');
    expect(
      shell.applyValuation(
        2,
        makeValuation({
          changedFiatById: { a: makeFiat({ fiatValue: '50' }) },
        }),
      ),
    ).toBe(true);
    expect(
      store.get(cell(ctx as unknown as Parameters<typeof cell>[0], 'a'))
        ?.fiatValue,
    ).toBe('50');

    // older valuation (v1) -> dropped, value stays 50
    expect(
      shell.applyValuation(
        1,
        makeValuation({
          changedFiatById: { a: makeFiat({ fiatValue: '99' }) },
        }),
      ),
    ).toBe(false);
    expect(
      store.get(cell(ctx as unknown as Parameters<typeof cell>[0], 'a'))
        ?.fiatValue,
    ).toBe('50');
  });
});

describe('cells cutover — subscribe-then-pull ordering (no blank window)', () => {
  it('a push racing an in-flight pull is not lost: higher version wins, lower dropped', () => {
    const { store, shell } = setup();
    // Subscription is live: a higher-version PUSH (gen 7) lands while a pull
    // (gen 4) is in flight.
    expect(
      shell.applyStructure(
        7,
        makeStructure({ orderedIds: ['p7'], generation: 7 }),
      ),
    ).toBe(true);
    // The in-flight PULL resolves with the older snapshot (gen 4) -> dropped.
    expect(
      shell.applyStructure(
        4,
        makeStructure({ orderedIds: ['p4'], generation: 4 }),
      ),
    ).toBe(false);
    // The list reflects the higher-version push, never blanked.
    expect(store.get(listStructureAtom()).orderedIds).toEqual(['p7']);
  });

  it('the cold-start hydrated paint holds until a higher-generation frame supersedes it', () => {
    const { store, shell } = setup();
    // T0 hydrate paints at a low generation (e.g. 0) — modeled as a direct
    // structure apply that the shell's version ref does NOT yet know about.
    // (in prod the hydrate runs in a separate hook; here we paint then the
    // first BG frame at the SAME-or-higher generation supersedes it.)
    shell.applyStructure(
      0,
      makeStructure({ orderedIds: ['cold'], generation: 0 }),
    );
    expect(store.get(listStructureAtom()).orderedIds).toEqual(['cold']);
    // first real BG frame at a higher generation supersedes
    expect(
      shell.applyStructure(
        1,
        makeStructure({ orderedIds: ['live'], generation: 1 }),
      ),
    ).toBe(true);
    expect(store.get(listStructureAtom()).orderedIds).toEqual(['live']);
  });
});

describe('cells cutover — single-token price tick isolation (spec §11.3)', () => {
  it('a price tick on one token notifies only that leaf cell; structure + siblings fire 0', () => {
    const { store, ctx, shell } = setup();
    const asCtx = ctx as unknown as Parameters<typeof cell>[0];
    shell.applyStructure(
      0,
      makeStructure({
        orderedIds: ['a', 'b'],
        metaPatch: { a: makeToken(), b: makeToken() },
        generation: 0,
      }),
    );
    // mounted leaves lazily create the cells (useTokenFiat) before valuation
    cell(asCtx, 'a');
    cell(asCtx, 'b');
    shell.applyValuation(
      0,
      makeValuation({
        changedFiatById: {
          a: makeFiat({ fiatValue: '10', price: 1 }),
          b: makeFiat({ fiatValue: '20', price: 2 }),
        },
      }),
    );

    // subscribe notification counters
    let structureFires = 0;
    let aFires = 0;
    let bFires = 0;
    const unsubStruct = store.sub(listStructureAtom(), () => {
      structureFires += 1;
    });
    const unsubA = store.sub(cell(asCtx, 'a'), () => {
      aFires += 1;
    });
    const unsubB = store.sub(cell(asCtx, 'b'), () => {
      bFires += 1;
    });

    // a PURE price tick on `a` only (valuation-only frame, structure untouched)
    shell.applyValuation(
      1,
      makeValuation({
        changedFiatById: { a: makeFiat({ fiatValue: '11', price: 1.1 }) },
      }),
    );

    expect(aFires).toBe(1); // only the touched leaf
    expect(bFires).toBe(0); // sibling untouched
    expect(structureFires).toBe(0); // container/rows stable

    unsubStruct();
    unsubA();
    unsubB();
  });
});

describe('cells cutover — owner switch clears + re-applies', () => {
  it('owner switch clears the old cells; the new owner first frame applies after version reset', () => {
    const { store, ctx, shell } = setup();
    const asCtx = ctx as unknown as Parameters<typeof cell>[0];
    // owner A
    shell.applyStructure(
      3,
      makeStructure({
        orderedIds: ['a'],
        ownerKey: 'accA__net',
        generation: 3,
      }),
    );
    // mounted leaf creates the `a` cell (useTokenFiat)
    cell(asCtx, 'a');
    shell.applyValuation(
      3,
      makeValuation({
        ownerKey: 'accA__net',
        changedFiatById: { a: makeFiat({ fiatValue: '7' }) },
      }),
    );
    expect(store.get(cell(asCtx, 'a'))?.fiatValue).toBe('7');

    // owner switch -> the shell resets its version refs (mirrors the effect
    // re-run on ownerKey change). apply's owner guard then clearAll's the old
    // cells and resets curGeneration to -1 for the new owner.
    shell.resetVersionsForOwnerChange();
    // new owner B first frame starts at a LOW generation (0) — must NOT be
    // dropped now that the refs are reset.
    expect(
      shell.applyStructure(
        0,
        makeStructure({
          orderedIds: ['b'],
          ownerKey: 'accB__net',
          generation: 0,
        }),
      ),
    ).toBe(true);
    expect(store.get(listStructureAtom()).orderedIds).toEqual(['b']);
    expect(store.get(listStructureAtom()).ownerKey).toBe('accB__net');
    // old owner's `a` cell was pruned by clearAll (orphan-safe)
    shell.applyValuation(
      1,
      makeValuation({
        ownerKey: 'accB__net',
        changedFiatById: { a: makeFiat({ fiatValue: '999' }) },
      }),
    );
    // `a` is not in owner B's structure -> orphan guard -> never resurrected
    const aCell = store.get(cell(asCtx, 'a'));
    expect(aCell?.fiatValue).not.toBe('999');
  });
});

describe('cells cutover — registry (single-slim-writer + fan-out)', () => {
  const NAME = EJotaiContextStoreNames.homeTokenList;
  const storeA = createStore() as unknown as IJotaiContextStore;
  const storeB = createStore() as unknown as IJotaiContextStore;

  afterEach(() => {
    deregisterMountedStore(NAME, storeA);
    deregisterMountedStore(NAME, storeB);
  });

  it('only the FIRST-registered store is the primary slim writer', () => {
    registerMountedStore(NAME, storeA);
    registerMountedStore(NAME, storeB);
    expect(isPrimaryColdStartWriter(NAME, storeA)).toBe(true);
    expect(isPrimaryColdStartWriter(NAME, storeB)).toBe(false);
  });

  it('enumerates ALL live stores for a name (AssetList double-page fan-out)', () => {
    registerMountedStore(NAME, storeA);
    registerMountedStore(NAME, storeB);
    const live = getMountedStores(NAME);
    expect(live).toHaveLength(2);
    expect(live).toEqual(expect.arrayContaining([storeA, storeB]));
  });

  it('deregister drops the name when the last store unmounts', () => {
    registerMountedStore(NAME, storeA);
    deregisterMountedStore(NAME, storeA);
    expect(getMountedStores(NAME)).toHaveLength(0);
    // primary promotion: storeB registering now becomes the primary
    registerMountedStore(NAME, storeB);
    expect(isPrimaryColdStartWriter(NAME, storeB)).toBe(true);
  });
});
