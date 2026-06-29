/**
 * TokenList cells — APPLY CONTRACT integration tests (spec §11.2). These are the
 * MERGE GATE for Slice 1. Run with node + a real jotai `createStore()` (no
 * React). They assert:
 *  - fire-count = number of cells that actually changed per fiatEqual
 *    (≤ changedFiatById.size; equal values -> 0 notifications; cells not in the
 *    frame -> 0);
 *  - orphan guard (pruned $key in valuation -> not created);
 *  - generation / owner guards drop stale / wrong-owner frames;
 *  - orderedIds reference stability on identical structure;
 *  - aggregate: writing one aggSubCell recomputes aggCell to the sum, writing
 *    an unrelated aggKey does not;
 *  - reset/recreate: resolveCurrentStore returns a new store -> old-store frame
 *    dropped.
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

import type { IApplyDeps } from '../cells/apply';
import type { IStoreProjection } from '../cells/projection';

type IStore = ReturnType<typeof createStore>;

// A fake storeData; the test injects its own `resolveCurrentStore` mapping so it
// never touches the real jotaiContextStore registry.
const STORE_DATA = {
  storeName: EJotaiContextStoreNames.homeTokenList,
} as IJotaiContextStoreData;
const OTHER_STORE_DATA = {
  storeName: EJotaiContextStoreNames.urlAccountHomeTokenList,
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

/**
 * Build the deps bag bound to a store, with `resolveCurrentStore` driven by an
 * injected lookup so reset/recreate can be simulated (spec §11.2).
 */
function makeDeps(
  store: IStore,
  resolve: (data: IJotaiContextStoreData) => IStore | undefined,
): IApplyDeps {
  // The contextAtom store is typed as IJotaiContextStore; node createStore is
  // structurally compatible for get/set/sub. Cast through unknown to satisfy
  // the apply signatures without `any`.
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

function setup(): {
  store: IStore;
  ctx: Parameters<typeof cell>[0];
  projection: IStoreProjection;
  deps: IApplyDeps;
} {
  const store = createStore();
  const ctx = store as unknown as Parameters<typeof cell>[0];
  const projection = ensureStoreProjection(ctx);
  const deps = makeDeps(store, (data) =>
    data.storeName === STORE_DATA.storeName ? store : undefined,
  );
  return { store, ctx, projection, deps };
}

describe('applyStructureSnapshot', () => {
  it('writes metaPatch + listStructureAtom and registers normal cells', () => {
    const { store, ctx, projection, deps } = setup();
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({
        orderedIds: ['a', 'b'],
        metaPatch: { a: makeToken({ symbol: 'A' }), b: makeToken() },
      }),
      deps,
    );
    expect(store.get(listStructureAtom()).orderedIds).toEqual(['a', 'b']);
    // metas applied
    expect(store.get(meta(ctx, 'a'))?.symbol).toBe('A');
  });

  it('flows smallBalanceFiatValue + fundedIds through to listStructureAtom (PR-0)', () => {
    const { store, ctx, projection, deps } = setup();
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({
        orderedIds: ['a', 'b'],
        nonZeroIds: ['a', 'b'],
        fundedIds: ['a'],
        smallBalanceFiatValue: '123.45',
      }),
      deps,
    );
    const s = store.get(listStructureAtom());
    expect(s.smallBalanceFiatValue).toBe('123.45');
    expect(s.fundedIds).toEqual(['a']);
    // nonZeroIds is untouched/independent
    expect(s.nonZeroIds).toEqual(['a', 'b']);
  });

  it('writes ownedAggregateTokenListMap to listStructureAtom (PR-7)', () => {
    const { store, ctx, projection, deps } = setup();
    const ownedAggregateTokenListMap = {
      aggregate_eth: {
        tokens: [{ $key: 'sub-a', ...makeToken({ symbol: 'A' }) }],
      },
    };
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({
        orderedIds: ['aggregate_eth'],
        metaPatch: {
          aggregate_eth: makeToken({ isAggregateToken: true }),
        },
        ownedAggregateTokenListMap,
      }),
      deps,
    );
    const s = store.get(listStructureAtom());
    expect(s.ownedAggregateTokenListMap.aggregate_eth.tokens[0].$key).toBe(
      'sub-a',
    );
  });

  it('keeps orderedIds reference-stable on identical structure', () => {
    const { store, ctx, projection, deps } = setup();
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({ orderedIds: ['a', 'b'], generation: 0 }),
      deps,
    );
    const ref1 = store.get(listStructureAtom()).orderedIds;
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({ orderedIds: ['a', 'b'], generation: 1 }),
      deps,
    );
    const ref2 = store.get(listStructureAtom()).orderedIds;
    expect(ref2).toBe(ref1);
  });

  it('drops a stale (<=) generation frame', () => {
    const { store, ctx, projection, deps } = setup();
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({ orderedIds: ['a'], generation: 5 }),
      deps,
    );
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({ orderedIds: ['stale'], generation: 5 }),
      deps,
    );
    expect(store.get(listStructureAtom()).orderedIds).toEqual(['a']);
  });

  it('owner switch clears the projection', () => {
    const { ctx, projection, deps } = setup();
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({
        orderedIds: ['a'],
        generation: 0,
        ownerKey: 'o1',
        metaPatch: { a: makeToken() },
      }),
      deps,
    );
    // applyStructureSnapshot registers meta cells (and seeds a fiat cell so the
    // owner-switch prune is observable).
    cell(ctx, 'a');
    expect(projection.metas.has('a')).toBe(true);
    expect(projection.cells.has('a')).toBe(true);
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({
        orderedIds: ['b'],
        generation: 0,
        ownerKey: 'o2',
        metaPatch: { b: makeToken() },
      }),
      deps,
    );
    expect(projection.curOwnerKey).toBe('o2');
    // o1's cells were cleared on the owner switch.
    expect(projection.cells.has('a')).toBe(false);
    expect(projection.metas.has('a')).toBe(false);
    expect(projection.metas.has('b')).toBe(true);
  });

  it('identity check drops a frame for a non-matching store', () => {
    const { store, ctx, projection, deps } = setup();
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({ orderedIds: ['a'], storeData: OTHER_STORE_DATA }),
      deps,
    );
    expect(store.get(listStructureAtom()).orderedIds).toEqual([]);
  });

  it('ensures aggregate sub-cells + aggCell from membership', () => {
    const { ctx, projection, deps } = setup();
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({
        orderedIds: ['aggregate_eth'],
        aggMembership: { aggregate_eth: ['net1', 'net2'] },
        metaPatch: { aggregate_eth: makeToken({ isAggregateToken: true }) },
      }),
      deps,
    );
    expect(projection.aggSubCells.get('aggregate_eth')?.size).toBe(2);
    expect(projection.aggCells.has('aggregate_eth')).toBe(true);
    // aggregate keys are NOT in the normal cell registry
    expect(projection.cells.has('aggregate_eth')).toBe(false);
  });

  it('keeps an aggregate row meta in orderedIds while pruning a stale non-live meta (regression: home aggregate row vanish)', () => {
    const { store, ctx, projection, deps } = setup();
    // Frame 1: a normal token + an aggregate row, plus a non-agg token that
    // will go stale on the next frame. The aggregate row appears in orderedIds
    // (TokenListBlock appends aggregate rows into the ordered list) and its meta
    // is written via metaPatch.
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({
        orderedIds: ['normal', 'aggregate_eth', 'stale'],
        aggMembership: { aggregate_eth: ['net1', 'net2'] },
        metaPatch: {
          normal: makeToken({ symbol: 'NRM' }),
          aggregate_eth: makeToken({ isAggregateToken: true }),
          stale: makeToken({ symbol: 'STALE' }),
        },
        generation: 0,
      }),
      deps,
    );
    // All three metas were registered by step 5.
    expect(projection.metas.has('aggregate_eth')).toBe(true);
    expect(projection.metas.has('normal')).toBe(true);
    expect(projection.metas.has('stale')).toBe(true);

    // Frame 2: `stale` drops out of the live id set, but the aggregate row
    // stays in orderedIds. The aggregate meta MUST survive (home cell path
    // rebuilds the row from its meta cell), while `stale` MUST be pruned.
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({
        orderedIds: ['normal', 'aggregate_eth'],
        aggMembership: { aggregate_eth: ['net1', 'net2'] },
        metaPatch: {},
        generation: 1,
      }),
      deps,
    );
    // Aggregate row meta SURVIVES (its key is a live ordered id).
    expect(projection.metas.has('aggregate_eth')).toBe(true);
    expect(store.get(meta(ctx, 'aggregate_eth'))?.isAggregateToken).toBe(true);
    // Live normal meta survives too.
    expect(projection.metas.has('normal')).toBe(true);
    // Stale (no longer live) meta is pruned.
    expect(projection.metas.has('stale')).toBe(false);
    // Aggregate keys still never enter the normal fiat-cell registry.
    expect(projection.cells.has('aggregate_eth')).toBe(false);
  });

  it('prunes a whole aggregate group that left membership', () => {
    const { ctx, projection, deps } = setup();
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({
        aggMembership: { agg: ['net1'] },
        generation: 0,
      }),
      deps,
    );
    expect(projection.aggSubCells.has('agg')).toBe(true);
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({ aggMembership: {}, generation: 1 }),
      deps,
    );
    expect(projection.aggSubCells.has('agg')).toBe(false);
    expect(projection.aggCells.has('agg')).toBe(false);
  });
});

describe('applyValuationFrame', () => {
  it('fires only for cells that actually changed (<= changedFiatById.size)', () => {
    const { store, ctx, projection, deps } = setup();
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({ orderedIds: ['a', 'b', 'c'] }),
      deps,
    );
    // seed a and b
    store.set(cell(ctx, 'a'), makeFiat({ fiatValue: '1' }));
    store.set(cell(ctx, 'b'), makeFiat({ fiatValue: '2' }));

    let fires = 0;
    const unsubA = store.sub(cell(ctx, 'a'), () => {
      fires += 1;
    });
    const unsubB = store.sub(cell(ctx, 'b'), () => {
      fires += 1;
    });
    const unsubC = store.sub(cell(ctx, 'c'), () => {
      fires += 1;
    });

    applyValuationFrame(
      ctx,
      projection,
      makeValuation({
        changedFiatById: {
          a: makeFiat({ fiatValue: '99' }), // changed
          b: makeFiat({ fiatValue: '2' }), // unchanged -> no fire
          // c absent -> no fire
        },
      }),
      deps,
    );

    expect(fires).toBe(1);
    expect(store.get(cell(ctx, 'a'))?.fiatValue).toBe('99');
    unsubA();
    unsubB();
    unsubC();
  });

  it('orphan guard: never lazy-creates a cell not in the structure', () => {
    const { ctx, projection, deps } = setup();
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({ orderedIds: ['a'] }),
      deps,
    );
    const sizeBefore = projection.cells.size;
    applyValuationFrame(
      ctx,
      projection,
      makeValuation({
        changedFiatById: { ghost: makeFiat({ fiatValue: '5' }) },
      }),
      deps,
    );
    expect(projection.cells.size).toBe(sizeBefore);
    expect(projection.cells.has('ghost')).toBe(false);
  });

  it('owner-switch round: structure pre-creates cells so a same-round valuation fills every key (no orphan-skip)', () => {
    // Regression: an account switch ran applyStructureSnapshot (clearAll) then
    // applyValuationFrame back-to-back BEFORE any leaf re-rendered to lazily
    // create the per-key cells, so the valuation orphan-skipped EVERY key and
    // the whole list (incl. small-balance rows feeding the low-value sheet)
    // stayed at "-". applyStructureSnapshot must pre-create the live normal
    // fiat cells (orderedIds ∪ smallBalanceIds) so the same-round valuation can
    // fill them.
    const { store, ctx, projection, deps } = setup();
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({ orderedIds: ['a', 'b'], smallBalanceIds: ['c'] }),
      deps,
    );
    // NO manual cell seeding — mimic the post-clearAll state where no leaf has
    // rendered yet. The cells must already exist from the structure apply.
    expect(projection.cells.has('a')).toBe(true);
    expect(projection.cells.has('b')).toBe(true);
    expect(projection.cells.has('c')).toBe(true);

    applyValuationFrame(
      ctx,
      projection,
      makeValuation({
        changedFiatById: {
          a: makeFiat({ fiatValue: '11' }),
          b: makeFiat({ fiatValue: '22' }),
          c: makeFiat({ fiatValue: '33' }),
        },
      }),
      deps,
    );

    expect(store.get(cell(ctx, 'a'))?.fiatValue).toBe('11');
    expect(store.get(cell(ctx, 'b'))?.fiatValue).toBe('22');
    expect(store.get(cell(ctx, 'c'))?.fiatValue).toBe('33');
  });

  it('owner guard drops a wrong-owner valuation', () => {
    const { store, ctx, projection, deps } = setup();
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({ orderedIds: ['a'], ownerKey: 'acc1__net1' }),
      deps,
    );
    applyValuationFrame(
      ctx,
      projection,
      makeValuation({
        ownerKey: 'WRONG',
        changedFiatById: { a: makeFiat({ fiatValue: '7' }) },
      }),
      deps,
    );
    expect(store.get(cell(ctx, 'a'))).toBeUndefined();
  });

  it('identity check drops a frame for a non-matching store', () => {
    const { store, ctx, projection, deps } = setup();
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({ orderedIds: ['a'] }),
      deps,
    );
    applyValuationFrame(
      ctx,
      projection,
      makeValuation({
        storeData: OTHER_STORE_DATA,
        changedFiatById: { a: makeFiat({ fiatValue: '7' }) },
      }),
      deps,
    );
    expect(store.get(cell(ctx, 'a'))).toBeUndefined();
  });

  it('aggregate: writing one sub-cell recomputes aggCell to the sum', () => {
    const { store, ctx, projection, deps } = setup();
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({
        orderedIds: ['aggregate_eth'],
        aggMembership: { aggregate_eth: ['net1', 'net2'] },
        metaPatch: { aggregate_eth: makeToken({ isAggregateToken: true }) },
      }),
      deps,
    );
    applyValuationFrame(
      ctx,
      projection,
      makeValuation({
        changedAggFiat: {
          aggregate_eth: {
            net1: makeFiat({ balance: '1', fiatValue: '10' }),
            net2: makeFiat({ balance: '2', fiatValue: '20' }),
          },
        },
      }),
      deps,
    );
    const agg = store.get(aggCell(ctx, 'aggregate_eth'));
    expect(agg?.balance).toBe('3');
    expect(agg?.fiatValue).toBe('30');
  });

  it('aggregate: writing an unrelated aggKey does not recompute aggCell', () => {
    const { store, ctx, projection, deps } = setup();
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({
        aggMembership: { agg1: ['net1'], agg2: ['net1'] },
        generation: 0,
      }),
      deps,
    );
    // seed agg1
    applyValuationFrame(
      ctx,
      projection,
      makeValuation({
        changedAggFiat: { agg1: { net1: makeFiat({ fiatValue: '10' }) } },
      }),
      deps,
    );
    let agg1Fires = 0;
    const unsub = store.sub(aggCell(ctx, 'agg1'), () => {
      agg1Fires += 1;
    });
    // write agg2 only
    applyValuationFrame(
      ctx,
      projection,
      makeValuation({
        changedAggFiat: { agg2: { net1: makeFiat({ fiatValue: '99' }) } },
      }),
      deps,
    );
    expect(agg1Fires).toBe(0);
    unsub();
  });

  it('reset/recreate: a frame for the old store is dropped', () => {
    const store = createStore();
    const ctx = store as unknown as Parameters<typeof cell>[0];
    const projection = ensureStoreProjection(ctx);
    // resolveCurrentStore returns a DIFFERENT store -> identity mismatch
    const newStore = createStore();
    const deps = makeDeps(store, () => newStore);
    applyStructureSnapshot(
      ctx,
      projection,
      makeStructure({ orderedIds: ['a'] }),
      deps,
    );
    expect(store.get(listStructureAtom()).orderedIds).toEqual([]);
  });
});
