/**
 * TokenList cells — COLD START fan-out hydrate integration tests (spec §7,
 * §11.2, §11.4). MERGE GATE for the §7 cold-start wiring. Run with node + a
 * real jotai `createStore()` (no React, no native). They assert:
 *  - a slim bundle fans out through the SAME apply contract: cells / metas /
 *    aggregate sub-cells + listStructureAtom are populated at T0;
 *  - the currency gate (shared shouldUseSlim) is a HARD merge gate: a matched
 *    currency paints, a mismatched currency MISSES (no paint) — exercised
 *    end-to-end through `hydrateCellsFromColdStart` reading the native snapshot.
 */
import { createStore } from 'jotai';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  fiatEqual,
  isAgg,
  metaEqual,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/pure';
import type { IStructureSnapshot } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/types';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { buildSlimSnapshot } from '@onekeyhq/shared/src/utils/tokenListSlimColdCacheUtils';
import type { ISlimSnapshotStructure } from '@onekeyhq/shared/src/utils/tokenListSlimColdCacheUtils';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { listStructureAtom, riskyListFrameAtom } from '../atoms';
import {
  applyStructureSnapshot,
  applyValuationFrame,
  buildApplyDeps,
  shallowEqualArray,
} from '../cells/apply';
import {
  fanOutSlimToApply,
  hydrateCellsFromColdStart,
} from '../cells/coldStart';
import { createTokenListOwnerCache } from '../cells/ownerCache';
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

const STORE_DATA = {
  storeName: EJotaiContextStoreNames.homeTokenList,
} as IJotaiContextStoreData;

const OWNER_KEY = 'acc1__net1';
const SCOPE_KEY = 'store:homeTokenList';
const SLIM_SCOPED_KEY = `${SCOPE_KEY}::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.tokenListSlimColdCacheAtom}`;

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
    riskyListFrameAtom: riskyListFrameAtom(),
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

function setup(): {
  store: IStore;
  ctx: Parameters<typeof cell>[0];
  projection: IStoreProjection;
  deps: IApplyDeps;
} {
  const store = createStore();
  // Stamp the cold-start scope key the way jotaiContextStore.createStore does,
  // so resolveStoreData round-trips through the injected resolveCurrentStore.
  (
    store as unknown as { __ONEKEY_JOTAI_COLD_START_SCOPE_KEY__?: string }
  ).__ONEKEY_JOTAI_COLD_START_SCOPE_KEY__ = SCOPE_KEY;
  const ctx = store as unknown as Parameters<typeof cell>[0];
  const projection = ensureStoreProjection(ctx);
  const deps = makeDeps(store, (data) =>
    data.storeName === STORE_DATA.storeName ? store : undefined,
  );
  return { store, ctx, projection, deps };
}

// A representative slim bundle: 2 normal ordered tokens, 1 small-balance, and
// 1 aggregate token spanning two networks (so the derived aggCell must sum).
function buildSlimFixture(currency: string) {
  const structure: ISlimSnapshotStructure = {
    orderedIds: ['a', 'b', 'aggregate_agg1'],
    smallBalanceIds: ['c'],
    aggMembership: { aggregate_agg1: ['net1', 'net2'] },
    ownerKey: OWNER_KEY,
    generation: 7,
  };
  const fiatByKey: Record<string, ITokenFiat | undefined> = {
    a: makeFiat({ balance: '100', fiatValue: '200', price: 2, currency }),
    b: makeFiat({ balance: '5', fiatValue: '50', price: 10, currency }),
    c: makeFiat({ balance: '1', fiatValue: '1', price: 1, currency }),
  };
  const aggFiatByKey: Record<string, Record<string, ITokenFiat | undefined>> = {
    aggregate_agg1: {
      net1: makeFiat({
        balance: '10',
        balanceParsed: '10',
        fiatValue: '30',
        price: 3,
        currency,
      }),
      net2: makeFiat({
        balance: '20',
        balanceParsed: '20',
        fiatValue: '60',
        price: 3,
        currency,
      }),
    },
  };
  const metaByKey: Record<string, IToken | undefined> = {
    a: makeToken({ symbol: 'A' }),
    b: makeToken({ symbol: 'B' }),
    c: makeToken({ symbol: 'C' }),
    aggregate_agg1: makeToken({ symbol: 'AGG', isAggregateToken: true }),
  };
  return buildSlimSnapshot({
    structure,
    fiatByKey,
    aggFiatByKey,
    metaByKey,
    currency,
  });
}

describe('fanOutSlimToApply', () => {
  it('fans a slim bundle out through apply: cells + metas + listStructure + aggCell sum', () => {
    const { store, ctx, projection, deps } = setup();
    const bundle = buildSlimFixture('usd');

    fanOutSlimToApply({
      store: ctx,
      projection,
      deps,
      bundle,
      storeData: STORE_DATA,
    });

    // listStructure populated (ids + membership + owner/gen).
    const structure = store.get(listStructureAtom());
    expect(structure.orderedIds).toEqual(['a', 'b', 'aggregate_agg1']);
    expect(structure.smallBalanceIds).toEqual(['c']);
    expect(structure.aggMembership).toEqual({
      aggregate_agg1: ['net1', 'net2'],
    });
    expect(structure.ownerKey).toBe(OWNER_KEY);
    expect(structure.generation).toBe(7);

    // normal cells painted (price + value at T0).
    expect(store.get(cell(ctx, 'a'))?.fiatValue).toBe('200');
    expect(store.get(cell(ctx, 'a'))?.price).toBe(2);
    expect(store.get(cell(ctx, 'b'))?.fiatValue).toBe('50');
    expect(store.get(cell(ctx, 'c'))?.fiatValue).toBe('1');

    // normal-token meta cells painted (name/icon at T0).
    expect(store.get(meta(ctx, 'a'))?.symbol).toBe('A');
    expect(store.get(meta(ctx, 'b'))?.symbol).toBe('B');
    // Aggregate-token meta IS retained in P.metas: the agg row is a live
    // ordered id, so apply prunes metas by the full live-key set (incl.
    // aggregate). The home cell path rebuilds each row from its meta cell, so
    // dropping the agg meta would make the agg row silently vanish. (The agg
    // row still resolves its fiat through aggCell; the meta carries its static
    // display fields.)
    expect(projection.metas.has('aggregate_agg1')).toBe(true);
    expect(store.get(meta(ctx, 'aggregate_agg1'))?.isAggregateToken).toBe(true);

    // aggregate per-network sub-cells painted.
    expect(store.get(subcell(ctx, 'aggregate_agg1', 'net1'))?.fiatValue).toBe(
      '30',
    );
    expect(store.get(subcell(ctx, 'aggregate_agg1', 'net2'))?.fiatValue).toBe(
      '60',
    );

    // derived aggCell sums the per-network sub-cells (30 + 60 = 90).
    const agg = store.get(aggCell(ctx, 'aggregate_agg1'));
    expect(agg?.fiatValue).toBe('90');
    expect(agg?.balanceParsed).toBe('30');
    // price/currency taken from the first member.
    expect(agg?.price).toBe(3);
    expect(agg?.currency).toBe('usd');
  });

  it('aggregate ids do NOT get a normal cell (flow through agg channel only)', () => {
    const { ctx, projection, deps } = setup();
    const bundle = buildSlimFixture('usd');
    fanOutSlimToApply({
      store: ctx,
      projection,
      deps,
      bundle,
      storeData: STORE_DATA,
    });
    // buildSlimSnapshot never writes a compactFiat entry for an aggregate id.
    expect(bundle.compactFiat.aggregate_agg1).toBeUndefined();
    // and the normal-cell registry has no aggregate entry.
    expect(projection.cells.has('aggregate_agg1')).toBe(false);
  });

  it('restores the REAL persisted smallBalanceFiatValue (not a hardcoded 0) — PR-0', () => {
    const { store, ctx, projection, deps } = setup();
    const bundle = buildSlimFixture('usd');
    // a slim bundle persisted WITH the scalar (PR-0 enabler).
    bundle.smallBalanceFiatValue = '88.88';

    fanOutSlimToApply({
      store: ctx,
      projection,
      deps,
      bundle,
      storeData: STORE_DATA,
    });

    expect(store.get(listStructureAtom()).smallBalanceFiatValue).toBe('88.88');
  });

  it('falls back to 0 when an OLDER bundle has no smallBalanceFiatValue', () => {
    const { store, ctx, projection, deps } = setup();
    const bundle = buildSlimFixture('usd');
    // simulate a pre-PR-0 persisted bundle: field absent on the wire.
    delete (bundle as { smallBalanceFiatValue?: string }).smallBalanceFiatValue;

    fanOutSlimToApply({
      store: ctx,
      projection,
      deps,
      bundle,
      storeData: STORE_DATA,
    });

    expect(store.get(listStructureAtom()).smallBalanceFiatValue).toBe('0');
  });

  it('widen restores balanceMultiplier from a compact fiat entry onto the cell (xStocks OK-58046)', () => {
    const { store, ctx, projection, deps } = setup();
    const bundle = buildSlimFixture('usd');
    // simulate a scaled-UI token (e.g. xStocks) whose compact fiat entry
    // persisted the multiplier on disk.
    bundle.compactFiat.a.balanceMultiplier = '1.0026642075893797';

    fanOutSlimToApply({
      store: ctx,
      projection,
      deps,
      bundle,
      storeData: STORE_DATA,
    });

    expect(store.get(cell(ctx, 'a'))?.balanceMultiplier).toBe(
      '1.0026642075893797',
    );
  });
});

describe('fanOutSlimToApply — cold paint is provisional (B1 regression)', () => {
  it('resets curGeneration so a fresh-session BG frame at gen 0 supersedes a HIGH-gen cold paint', () => {
    const { store, ctx, projection, deps } = setup();
    const bundle = buildSlimFixture('usd');
    // A high generation persisted from a PREVIOUS session. The live BG
    // ServiceTokenViewModel restarts its per-owner counter at -1 each process,
    // so its first frame this session is gen 0 — far below this value.
    bundle.gen = 30;

    fanOutSlimToApply({
      store: ctx,
      projection,
      deps,
      bundle,
      storeData: STORE_DATA,
    });

    // Cold paint applied...
    expect(store.get(listStructureAtom()).orderedIds).toEqual([
      'a',
      'b',
      'aggregate_agg1',
    ]);
    // ...but curGeneration is reset to -1 (provisional), NOT left at 30. Without
    // this reset apply's generation guard would drop the gen-0 BG frame below.
    expect(projection.curGeneration).toBe(-1);

    // The fresh-session BG VM emits its first structure frame at gen 0 with a
    // DIFFERENT order. It MUST supersede the stale cold paint.
    const bgStructure: IStructureSnapshot = {
      orderedIds: ['b', 'a'],
      smallBalanceIds: [],
      nonZeroIds: [],
      fundedIds: [],
      metaPatch: {},
      aggMembership: {},
      smallBalanceFiatValue: '0',
      ownedAggregateTokenListMap: {},
      storeData: STORE_DATA,
      ownerKey: OWNER_KEY,
      generation: 0,
    };
    applyStructureSnapshot(ctx, projection, bgStructure, deps);

    // Superseded: list now reflects the live BG order, not the cold snapshot.
    expect(store.get(listStructureAtom()).orderedIds).toEqual(['b', 'a']);
    expect(projection.curGeneration).toBe(0);
  });
});

describe('hydrateCellsFromColdStart — currency gate (merge gate, spec §11.4)', () => {
  const globalRef = globalThis as typeof globalThis & {
    __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
  };

  afterEach(() => {
    delete globalRef.__ONEKEY_CTX_ATOM_SNAPSHOT__;
  });

  it('paints when the stored currency matches the current currency', () => {
    const { store, ctx, projection, deps } = setup();
    globalRef.__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
      [SLIM_SCOPED_KEY]: buildSlimFixture('usd'),
    };

    const painted = hydrateCellsFromColdStart({
      store: ctx,
      projection,
      deps,
      currentCurrency: 'usd',
    });

    expect(painted).toBe(true);
    expect(store.get(listStructureAtom()).orderedIds).toEqual([
      'a',
      'b',
      'aggregate_agg1',
    ]);
    expect(store.get(cell(ctx, 'a'))?.fiatValue).toBe('200');
  });

  it('MISSES (no paint) when the stored currency mismatches the current currency', () => {
    const { store, ctx, projection, deps } = setup();
    globalRef.__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
      [SLIM_SCOPED_KEY]: buildSlimFixture('eur'),
    };

    const painted = hydrateCellsFromColdStart({
      store: ctx,
      projection,
      deps,
      currentCurrency: 'usd',
    });

    expect(painted).toBe(false);
    // nothing painted: structure untouched, no cells.
    expect(store.get(listStructureAtom()).orderedIds).toEqual([]);
    expect(projection.cells.size).toBe(0);
  });

  it('rejects a boot snapshot belonging to a different account', () => {
    const { ctx, projection, deps, store } = setup();
    (
      globalThis as typeof globalThis & {
        __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
      }
    ).__ONEKEY_CTX_ATOM_SNAPSHOT__ = {
      [SLIM_SCOPED_KEY]: buildSlimFixture('usd'),
    };
    expect(
      hydrateCellsFromColdStart({
        store: ctx,
        projection,
        deps,
        currentCurrency: 'usd',
        ownerKey: 'another__net1',
      }),
    ).toBe(false);
    expect(store.get(listStructureAtom()).orderedIds).toEqual([]);
  });

  it('MISSES when no slim bundle is present', () => {
    const { ctx, projection, deps } = setup();
    const painted = hydrateCellsFromColdStart({
      store: ctx,
      projection,
      deps,
      currentCurrency: 'usd',
    });
    expect(painted).toBe(false);
  });
});

describe('account switch display cache', () => {
  function seed(
    target: ReturnType<typeof setup>,
    ownerKey: string,
    value: string,
  ) {
    const { ctx, store, projection, deps } = target;
    fanOutSlimToApply({
      store: ctx,
      projection,
      deps,
      bundle: {
        ...buildSlimFixture('usd'),
        ownerKey,
        ownedAggregateTokenListMap: {
          aggregate_agg1: {
            tokens: [{ ...makeToken(), networkId: 'net1', $key: 'member1' }],
          },
        },
      },
      storeData: STORE_DATA,
    });
    applyStructureSnapshot(
      ctx,
      projection,
      {
        ...store.get(listStructureAtom()),
        metaPatch: {},
        storeData: STORE_DATA,
        generation: 8,
      },
      deps,
    );
    applyValuationFrame(
      ctx,
      projection,
      {
        ownerKey,
        storeData: STORE_DATA,
        changedFiatById: {
          a: makeFiat({
            balance: value,
            balanceParsed: value,
            fiatValue: value,
            currency: 'usd',
          }),
        },
        changedAggFiat: {},
      },
      deps,
      (fn) => fn(),
    );
    store.set(riskyListFrameAtom(), {
      ownerKey,
      riskyTokens: [],
      riskyMap: {},
    });
  }

  it('restores full balances and aggregate membership synchronously on A-B-A', () => {
    const target = setup();
    const { ctx, store, deps } = target;
    const restore = createTokenListOwnerCache(ctx, deps, STORE_DATA);
    seed(target, 'A__all', '1000000000000000000');
    expect(restore('B__all', 'usd')).toBe(false);
    seed(target, 'B__all', '2000000000000000000');
    expect(restore('A__all', 'usd')).toBe(true);
    expect(store.get(cell(ctx, 'a'))?.balance).toBe('1000000000000000000');
    expect(store.get(listStructureAtom()).ownerKey).toBe('A__all');
    expect(store.get(listStructureAtom()).aggMembership).toEqual({
      aggregate_agg1: ['net1', 'net2'],
    });
    expect(
      store.get(listStructureAtom()).ownedAggregateTokenListMap.aggregate_agg1
        .tokens[0].$key,
    ).toBe('member1');
    expect(store.get(aggCell(ctx, 'aggregate_agg1'))?.fiatValue).toBe('90');
    expect(store.get(riskyListFrameAtom()).ownerKey).toBe('A__all');
    expect(restore('B__all', 'usd')).toBe(true);
    expect(store.get(cell(ctx, 'a'))?.balance).toBe('2000000000000000000');
  });

  it('does not reuse another network, currency, or an incomplete projection', () => {
    const target = setup();
    const { ctx, store, deps, projection } = target;
    const restore = createTokenListOwnerCache(ctx, deps, STORE_DATA);
    seed(target, 'A__bnb', '1');
    restore('B__bnb', 'usd');
    seed(target, 'B__bnb', '2');
    expect(restore('A__eth', 'usd')).toBe(false);
    expect(restore('A__bnb', 'eur')).toBe(false);
    expect(store.get(listStructureAtom()).ownerKey).toBe('B__bnb');
    store.set(cell(ctx, 'a'), undefined);
    restore('C__bnb', 'usd');
    // A fresh cache must not capture partially applied cells.
    const freshRestore = createTokenListOwnerCache(ctx, deps, STORE_DATA);
    freshRestore('C__bnb', 'usd');
    seed(target, 'C__bnb', '3');
    expect(freshRestore('B__bnb', 'usd')).toBe(false);
    expect(projection.curOwnerKey).toBe('C__bnb');
  });

  it('bounds retained owners and lets subsequent BG frames replace the restored data', () => {
    const target = setup();
    const { ctx, store, deps, projection } = target;
    const restore = createTokenListOwnerCache(ctx, deps, STORE_DATA);
    for (let i = 0; i < 6; i += 1) {
      seed(target, `${i}__bnb`, String(i));
      restore(`${i + 1}__bnb`, 'usd');
    }
    expect(restore('0__bnb', 'usd')).toBe(false);
    expect(restore('4__bnb', 'usd')).toBe(true);
    applyValuationFrame(
      ctx,
      projection,
      {
        ownerKey: '4__bnb',
        storeData: STORE_DATA,
        changedFiatById: { a: makeFiat({ balance: '42', currency: 'usd' }) },
        changedAggFiat: {},
      },
      deps,
      (fn) => fn(),
    );
    expect(store.get(cell(ctx, 'a'))?.balance).toBe('42');
    applyStructureSnapshot(
      ctx,
      projection,
      {
        ...store.get(listStructureAtom()),
        orderedIds: ['a'],
        smallBalanceIds: [],
        metaPatch: {},
        aggMembership: {},
        storeData: STORE_DATA,
        generation: 0,
      },
      deps,
    );
    expect(store.get(listStructureAtom()).orderedIds).toEqual(['a']);
    expect(projection.curGeneration).toBe(0);
  });
});
