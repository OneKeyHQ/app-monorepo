/**
 * TokenList cells — projection (state shell) tests (spec §3, §3.1). Node + a real
 * jotai `createStore()`, no React. They assert the lazy cell builders are
 * memoized per `$key`, the derived aggregate cell sums its sub-cells off the
 * structure membership, clearAll resets the registry, and ensureStoreProjection
 * is get-or-create.
 */
import { createStore } from 'jotai';

import type { ITokenFiat } from '@onekeyhq/shared/types/token';

import { listStructureAtom } from '../atoms';
import {
  aggCell,
  cell,
  clearAll,
  ensureStoreProjection,
  getStoreProjection,
  meta,
  subcell,
} from '../cells/projection';

import type { cell as cellType } from '../cells/projection';

type ICtxStore = Parameters<typeof cellType>[0];

function makeStore(): ICtxStore {
  return createStore() as unknown as ICtxStore;
}

function makeFiat(overrides: Partial<ITokenFiat> = {}): ITokenFiat {
  return {
    balance: '0',
    balanceParsed: '0',
    fiatValue: '0',
    price: 0,
    ...overrides,
  };
}

describe('ensureStoreProjection', () => {
  it('is get-or-create: same store -> same projection', () => {
    const store = makeStore();
    const p1 = ensureStoreProjection(store);
    const p2 = ensureStoreProjection(store);
    expect(p1).toBe(p2);
    expect(getStoreProjection(store)).toBe(p1);
  });

  it('different stores get different projections', () => {
    const a = ensureStoreProjection(makeStore());
    const b = ensureStoreProjection(makeStore());
    expect(a).not.toBe(b);
  });
});

describe('lazy cell builders', () => {
  it('cell() returns the same atom for the same $key', () => {
    const store = makeStore();
    expect(cell(store, 'a')).toBe(cell(store, 'a'));
    expect(cell(store, 'a')).not.toBe(cell(store, 'b'));
  });

  it('meta() returns the same atom for the same $key', () => {
    const store = makeStore();
    expect(meta(store, 'a')).toBe(meta(store, 'a'));
  });

  it('subcell() returns the same atom for the same (aggKey, net)', () => {
    const store = makeStore();
    expect(subcell(store, 'agg', 'net1')).toBe(subcell(store, 'agg', 'net1'));
    expect(subcell(store, 'agg', 'net1')).not.toBe(
      subcell(store, 'agg', 'net2'),
    );
  });
});

describe('aggCell (derived)', () => {
  it('sums its sub-cells off the structure membership', () => {
    const store = makeStore();
    const s = store as unknown as ReturnType<typeof createStore>;
    // membership must be present for the derived cell to find members
    s.set(listStructureAtom(), {
      orderedIds: [],
      smallBalanceIds: [],
      nonZeroIds: [],
      fundedIds: [],
      aggMembership: { agg: ['net1', 'net2'] },
      ownerKey: 'o',
      generation: 0,
      smallBalanceFiatValue: '0',
      ownedAggregateTokenListMap: {},
    });
    s.set(
      subcell(store, 'agg', 'net1'),
      makeFiat({ balance: '1', fiatValue: '10' }),
    );
    s.set(
      subcell(store, 'agg', 'net2'),
      makeFiat({ balance: '2', fiatValue: '20' }),
    );

    const derived = aggCell(store, 'agg');
    const value = s.get(derived);
    expect(value?.balance).toBe('3');
    expect(value?.fiatValue).toBe('30');
  });

  it('returns the same derived atom instance for the same aggKey', () => {
    const store = makeStore();
    expect(aggCell(store, 'agg')).toBe(aggCell(store, 'agg'));
  });
});

describe('clearAll', () => {
  it('clears all maps and resets owner/generation', () => {
    const store = makeStore();
    const p = ensureStoreProjection(store);
    cell(store, 'a');
    meta(store, 'a');
    subcell(store, 'agg', 'net1');
    aggCell(store, 'agg');
    p.curOwnerKey = 'owner';
    p.curGeneration = 5;

    clearAll(p);

    expect(p.cells.size).toBe(0);
    expect(p.metas.size).toBe(0);
    expect(p.aggSubCells.size).toBe(0);
    expect(p.aggCells.size).toBe(0);
    expect(p.curOwnerKey).toBeUndefined();
    expect(p.curGeneration).toBe(-1);
  });
});
