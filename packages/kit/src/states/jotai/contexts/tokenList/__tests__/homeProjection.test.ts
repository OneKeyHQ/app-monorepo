/**
 * TokenList cells — HOME projection PURE PARITY tests (spec §1, §11.3, §11.5).
 *
 * MERGE GATE for PR-S. Run in node with no React / jotai / native:
 * `projectHomeDisplayIds` is pure data in / pure data out.
 *
 * They assert:
 *  - sort parity (price / value / name, both directions) vs the legacy
 *    whole-map sort helpers (sortTokensByPrice / sortTokensByFiatValue /
 *    sortTokensByName) for the HOME case;
 *  - missing-fiat fallback parity (value -> -1, price -> 0; risk #1);
 *  - tie stability preserves producer (orderedIds) order (risk #2);
 *  - search composition: non-search uses orderedIds ONLY; search merges
 *    smallBalanceIds (risk #3); non-network keyword + aggregate sub-token
 *    address match (risk #6);
 *  - hideZero keeps only nonZeroIds membership (risk #4);
 *  - the displayIds memo dep-set used by the container does NOT include the
 *    live fiat map, so a price-only frame does not recompute the projection
 *    (priceTickNoListRecompute, risk #9).
 */
import { createStore } from 'jotai';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { buildFrames } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/buildFrames';
import type { IBuildFramesPrev } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/buildFrames';
import {
  fiatEqual,
  isAgg,
  metaEqual,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/pure';
import {
  getFilteredTokenBySearchKey,
  sortTokensByFiatValue,
  sortTokensByName,
  sortTokensByPrice,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import { ETokenListSortType } from '@onekeyhq/shared/types/token';
import type {
  IAccountToken,
  IToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { listStructureAtom } from '../atoms';
import {
  applyStructureSnapshot,
  applyValuationFrame,
  buildApplyDeps,
  shallowEqualArray,
} from '../cells/apply';
import { projectHomeDisplayIds } from '../cells/homeProjection';
import {
  aggCell,
  cell,
  clearAll,
  ensureStoreProjection,
  meta as metaCell,
  subcell,
} from '../cells/projection';

import type { IApplyDeps } from '../cells/apply';

function makeFiat(overrides: Partial<ITokenFiat> = {}): ITokenFiat {
  return {
    balance: '0',
    balanceParsed: '0',
    fiatValue: '0',
    price: 0,
    ...overrides,
  };
}

function makeToken(key: string, overrides: Partial<IToken> = {}): IToken {
  return {
    name: `name-${key}`,
    symbol: key.toUpperCase(),
    decimals: 18,
    address: `0x${key}`,
    isNative: false,
    ...overrides,
  };
}

// Fixture: a -> b -> c in producer (orderedIds) order, with descending,
// ascending, and missing fiat to exercise the fallback semantics.
const META: Record<string, IToken> = {
  a: makeToken('a', { name: 'Apple', address: '0xaaa' }),
  b: makeToken('b', { name: 'Banana', address: '0xbbb' }),
  c: makeToken('c', { name: 'Cherry', address: '0xccc' }),
};
const FIAT: Record<string, ITokenFiat> = {
  a: makeFiat({ balance: '10', fiatValue: '100', price: 5 }),
  b: makeFiat({ balance: '5', fiatValue: '50', price: 9 }),
  // c: no fiat entry -> missing-fiat fallback path.
};

const ORDERED = ['a', 'b', 'c'];

const getFiat = (k: string) => FIAT[k];
const getMeta = (k: string) => META[k];

/** Legacy whole-map path for the same fixture (the parity oracle). */
function legacyOrder(params: {
  sortType: ETokenListSortType;
  sortDirection: 'asc' | 'desc';
  searchKey?: string;
  ids?: string[];
}): string[] {
  const ids = params.ids ?? ORDERED;
  const tokens: IAccountToken[] = ids.map((k) => ({ $key: k, ...META[k] }));
  const map: Record<string, ITokenFiat> = {};
  for (const k of ids) {
    if (FIAT[k]) {
      map[k] = FIAT[k];
    }
  }
  let resp = getFilteredTokenBySearchKey({
    tokens,
    searchKey: params.searchKey ?? '',
  });
  if (params.sortType === ETokenListSortType.Price) {
    resp = sortTokensByPrice({
      tokens: resp,
      sortDirection: params.sortDirection,
      map,
    });
  } else if (params.sortType === ETokenListSortType.Value) {
    resp = sortTokensByFiatValue({
      tokens: resp,
      sortDirection: params.sortDirection,
      map,
    });
  } else if (params.sortType === ETokenListSortType.Name) {
    resp = sortTokensByName({
      tokens: resp,
      sortDirection: params.sortDirection,
    });
  }
  return resp.map((t) => t.$key);
}

function project(params: {
  sortType: ETokenListSortType;
  sortDirection: 'asc' | 'desc';
  searchKey?: string;
  hideZero?: boolean;
  nonZeroIds?: string[];
  smallBalanceIds?: string[];
}): string[] {
  return projectHomeDisplayIds({
    orderedIds: ORDERED,
    smallBalanceIds: params.smallBalanceIds ?? [],
    nonZeroIds: params.nonZeroIds ?? ORDERED,
    searchKey: params.searchKey ?? '',
    sortType: params.sortType,
    sortDirection: params.sortDirection,
    hideZero: !!params.hideZero,
    getFiat,
    getMeta,
  });
}

describe('projectHomeDisplayIds — sort parity', () => {
  const cases: Array<{
    sortType: ETokenListSortType;
    sortDirection: 'asc' | 'desc';
  }> = [
    { sortType: ETokenListSortType.Price, sortDirection: 'desc' },
    { sortType: ETokenListSortType.Price, sortDirection: 'asc' },
    { sortType: ETokenListSortType.Value, sortDirection: 'desc' },
    { sortType: ETokenListSortType.Value, sortDirection: 'asc' },
    { sortType: ETokenListSortType.Name, sortDirection: 'desc' },
    { sortType: ETokenListSortType.Name, sortDirection: 'asc' },
  ];

  it.each(cases)(
    'matches legacy whole-map order for %o',
    ({ sortType, sortDirection }) => {
      expect(project({ sortType, sortDirection })).toEqual(
        legacyOrder({ sortType, sortDirection }),
      );
    },
  );

  it('value sort treats missing fiat as -1 (sinks to bottom on desc)', () => {
    // c has no fiat -> -1; a(100) > b(50) > c(-1) on desc.
    expect(
      project({
        sortType: ETokenListSortType.Value,
        sortDirection: 'desc',
      }),
    ).toEqual(['a', 'b', 'c']);
  });

  it('price sort treats missing fiat as 0 (sinks to bottom on desc)', () => {
    // price b(9) > a(5) > c(0).
    expect(
      project({
        sortType: ETokenListSortType.Price,
        sortDirection: 'desc',
      }),
    ).toEqual(['b', 'a', 'c']);
  });
});

describe('projectHomeDisplayIds — tie stability (risk #2)', () => {
  it('equal sort keys preserve producer (orderedIds) order', () => {
    // All same price -> ties; must keep a,b,c order.
    const flat = projectHomeDisplayIds({
      orderedIds: ['a', 'b', 'c'],
      smallBalanceIds: [],
      nonZeroIds: ['a', 'b', 'c'],
      searchKey: '',
      sortType: ETokenListSortType.Price,
      sortDirection: 'desc',
      hideZero: false,
      getFiat: () => makeFiat({ price: 7 }),
      getMeta,
    });
    expect(flat).toEqual(['a', 'b', 'c']);
  });
});

describe('projectHomeDisplayIds — search composition (risk #3, #6)', () => {
  it('non-search uses orderedIds only (small balance NOT merged)', () => {
    const out = projectHomeDisplayIds({
      orderedIds: ['a', 'b'],
      smallBalanceIds: ['c'],
      nonZeroIds: ['a', 'b', 'c'],
      searchKey: '',
      sortType: ETokenListSortType.Name,
      sortDirection: 'asc',
      hideZero: false,
      getFiat,
      getMeta,
    });
    expect(out).toEqual(['a', 'b']);
  });

  it('search merges smallBalanceIds then filters by keyword', () => {
    const out = projectHomeDisplayIds({
      orderedIds: ['a', 'b'],
      smallBalanceIds: ['c'],
      nonZeroIds: ['a', 'b', 'c'],
      searchKey: 'cherry',
      sortType: ETokenListSortType.Name,
      sortDirection: 'asc',
      hideZero: false,
      getFiat,
      getMeta,
    });
    expect(out).toEqual(['c']);
  });

  it('matches aggregate sub-token address via aggregateTokenListMap', () => {
    const aggMeta: IToken = makeToken('aggregate_eth', {
      name: 'Ether',
      isAggregateToken: true,
      address: 'aggregate_eth',
    });
    const out = projectHomeDisplayIds({
      orderedIds: ['aggregate_eth', 'a'],
      smallBalanceIds: [],
      nonZeroIds: ['aggregate_eth', 'a'],
      searchKey: '0xdeadbeef',
      sortType: ETokenListSortType.Name,
      sortDirection: 'asc',
      hideZero: false,
      getFiat: () => undefined,
      getMeta: (k) => (k === 'aggregate_eth' ? aggMeta : META[k]),
      aggregateTokenListMap: {
        aggregate_eth: {
          tokens: [makeToken('sub', { address: '0xDEADBEEF' })],
        },
      },
    });
    expect(out).toEqual(['aggregate_eth']);
  });
});

describe('projectHomeDisplayIds — hideZero (risk #4)', () => {
  it('keeps only nonZeroIds membership', () => {
    const out = project({
      sortType: ETokenListSortType.Name,
      sortDirection: 'asc',
      hideZero: true,
      nonZeroIds: ['a', 'c'], // b excluded
    });
    expect(out).toEqual(['a', 'c']);
  });

  it('no hideZero keeps all ordered ids', () => {
    const out = project({
      sortType: ETokenListSortType.Name,
      sortDirection: 'asc',
      hideZero: false,
      nonZeroIds: ['a'],
    });
    expect(out).toEqual(['a', 'b', 'c']);
  });
});

/**
 * hideDeFiMarked parity (blocker #2): the legacy home `tokens` memo applies
 * `resultTokens.filter(item => !isTokenSelectorDappToken(item))` when
 * `hideDeFiMarkedTokens` (TokenListBlock passes TRUE on normal home).
 * `isTokenSelectorDappToken` is true for any token with a non-empty
 * `dappName`. The projection must drop those ids when `hideDeFiMarked` so the
 * seam path matches the legacy whole-map path.
 */
describe('projectHomeDisplayIds — hideDeFiMarked (blocker #2)', () => {
  const metaWithDapp: Record<string, IToken> = {
    a: makeToken('a', { name: 'Apple' }),
    // b is dapp-marked -> must be excluded when hideDeFiMarked.
    b: makeToken('b', { name: 'Banana', dappName: 'Uniswap' }),
    c: makeToken('c', { name: 'Cherry' }),
  };

  it('drops ids whose meta carries a non-empty dappName', () => {
    const out = projectHomeDisplayIds({
      orderedIds: ['a', 'b', 'c'],
      smallBalanceIds: [],
      nonZeroIds: ['a', 'b', 'c'],
      searchKey: '',
      sortType: ETokenListSortType.Name,
      sortDirection: 'asc',
      hideZero: false,
      hideDeFiMarked: true,
      getFiat,
      getMeta: (k) => metaWithDapp[k],
    });
    expect(out).toEqual(['a', 'c']);
  });

  it('keeps dapp-marked ids when hideDeFiMarked is false (LP mode)', () => {
    const out = projectHomeDisplayIds({
      orderedIds: ['a', 'b', 'c'],
      smallBalanceIds: [],
      nonZeroIds: ['a', 'b', 'c'],
      searchKey: '',
      sortType: ETokenListSortType.Name,
      sortDirection: 'asc',
      hideZero: false,
      hideDeFiMarked: false,
      getFiat,
      getMeta: (k) => metaWithDapp[k],
    });
    expect(out).toEqual(['a', 'b', 'c']);
  });

  it('whitespace-only dappName is NOT treated as marked (trim parity)', () => {
    const metaBlank: Record<string, IToken> = {
      a: makeToken('a', { name: 'Apple', dappName: '   ' }),
      b: makeToken('b', { name: 'Banana' }),
    };
    const out = projectHomeDisplayIds({
      orderedIds: ['a', 'b'],
      smallBalanceIds: [],
      nonZeroIds: ['a', 'b'],
      searchKey: '',
      sortType: ETokenListSortType.Name,
      sortDirection: 'asc',
      hideZero: false,
      hideDeFiMarked: true,
      getFiat,
      getMeta: (k) => metaBlank[k],
    });
    expect(out).toEqual(['a', 'b']);
  });
});

/**
 * priceTickNoListRecompute (risk #9): the container memoizes `displayIds` on a
 * dep-set that EXCLUDES the live fiat map — it depends on
 * `listStructure.generation` + sort + search + hideZero. A pure price tick
 * emits NO structure frame (`buildFrames` returns `structure: undefined`), so
 * `listStructureAtom` (generation + orderedIds) is unchanged and the home
 * displayIds memo's deps are stable → the projection is not re-invoked; only
 * the changed leaf cell re-renders.
 *
 * Unlike the old version (which hand-built two literal dep tuples), this drives
 * the REAL cells store: it applies a structure frame, captures the listStructure
 * value, applies a valuation-only frame produced by `buildFrames`, and asserts
 * the listStructure generation AND the orderedIds array IDENTITY are unchanged
 * — i.e. the memo deps the container reads off `listStructureAtom` cannot move
 * on a fiat-only tick.
 */
type IStore = ReturnType<typeof createStore>;

const PRICE_TICK_STORE_DATA = {
  storeName: EJotaiContextStoreNames.homeTokenList,
} as IJotaiContextStoreData;

function makeAccountToken(key: string, overrides: Partial<IToken> = {}) {
  return { $key: key, ...makeToken(key, overrides) } as IAccountToken;
}

function makePriceTickDeps(store: IStore): IApplyDeps {
  const asCtx = store as unknown as Parameters<typeof cell>[0];
  return buildApplyDeps({
    store: asCtx,
    listStructureAtom: listStructureAtom(),
    resolveCurrentStore: () =>
      asCtx as unknown as ReturnType<IApplyDeps['resolveCurrentStore']>,
    fiatEqual,
    metaEqual,
    isAgg,
    clearAll,
    shallowEqual: shallowEqualArray,
    meta: metaCell,
    cell,
    subcell,
    aggCell,
  });
}

describe('projectHomeDisplayIds — price tick does not change listStructure deps', () => {
  it('valuation-only frame keeps generation + orderedIds identity unchanged', () => {
    const store = createStore();
    const asCtx = store as unknown as Parameters<
      typeof ensureStoreProjection
    >[0];
    const projection = ensureStoreProjection(asCtx);
    const deps = makePriceTickDeps(store);

    const orderedTokens = [makeAccountToken('a'), makeAccountToken('b')];
    const ownerKey = 'acc1__net1';
    const fiatRound1: Record<string, ITokenFiat> = {
      a: makeFiat({ balance: '10', fiatValue: '100', price: 5 }),
      b: makeFiat({ balance: '5', fiatValue: '50', price: 9 }),
    };

    const prev: IBuildFramesPrev = {
      structure: {
        orderedIds: [],
        smallBalanceIds: [],
        nonZeroIds: [],
        fundedIds: [],
        aggMembership: {},
        ownerKey: '',
        generation: -1,
        ownedAggregateTokenListMap: {},
      },
      smallBalanceFiatValue: '0',
      metaByKey: {},
    };

    // Round 1: a structure frame establishes ids + generation + cells.
    const round1 = buildFrames(
      {
        orderedTokens,
        smallBalanceTokens: [],
        tokenListMap: fiatRound1,
        aggregateTokensMap: {},
        smallBalanceFiatValue: '0',
        ownerKey,
        storeData: PRICE_TICK_STORE_DATA,
      },
      prev,
    );
    expect(round1.structure).toBeDefined();
    if (round1.structure) {
      applyStructureSnapshot(asCtx, projection, round1.structure, deps);
    }
    // Seed the normal fiat cells (the producer does this; applyValuationFrame is
    // orphan-guarded and only writes EXISTING cells).
    cell(asCtx, 'a');
    cell(asCtx, 'b');
    applyValuationFrame(asCtx, projection, round1.valuation, deps);

    const structureAfterRound1 = store.get(listStructureAtom());
    const generationBefore = structureAfterRound1.generation;
    const orderedIdsRefBefore = structureAfterRound1.orderedIds;

    // Round 2: a PURE PRICE TICK — same ids/meta/membership, only fiat moves
    // (and enough to CROSS the value sort, proving order could differ if the
    // memo depended on fiat).
    const fiatRound2: Record<string, ITokenFiat> = {
      a: makeFiat({ balance: '10', fiatValue: '1', price: 50 }),
      b: makeFiat({ balance: '5', fiatValue: '999', price: 40 }),
    };
    const round2 = buildFrames(
      {
        orderedTokens,
        smallBalanceTokens: [],
        tokenListMap: fiatRound2,
        aggregateTokensMap: {},
        smallBalanceFiatValue: '0',
        ownerKey,
        storeData: PRICE_TICK_STORE_DATA,
      },
      {
        structure: {
          orderedIds: round1.structure?.orderedIds ?? [],
          smallBalanceIds: round1.structure?.smallBalanceIds ?? [],
          nonZeroIds: round1.structure?.nonZeroIds ?? [],
          fundedIds: round1.structure?.fundedIds ?? [],
          aggMembership: round1.structure?.aggMembership ?? {},
          ownerKey,
          generation: generationBefore,
          ownedAggregateTokenListMap:
            round1.structure?.ownedAggregateTokenListMap ?? {},
        },
        smallBalanceFiatValue: '0',
        metaByKey: { a: makeToken('a'), b: makeToken('b') },
      },
    );

    // No structure frame on a pure price tick.
    expect(round2.structure).toBeUndefined();

    applyValuationFrame(asCtx, projection, round2.valuation, deps);

    const structureAfterRound2 = store.get(listStructureAtom());

    // The container's displayIds memo deps read off listStructureAtom: the
    // generation is unchanged and the orderedIds ARRAY IDENTITY is preserved
    // (no structure write at all), so the memo would NOT recompute.
    expect(structureAfterRound2.generation).toBe(generationBefore);
    expect(structureAfterRound2.orderedIds).toBe(orderedIdsRefBefore);

    // Sanity: the cells DID move (the leaf re-renders), and re-projecting with
    // the new fiat snapshot would cross the value sort — which is exactly why
    // the memo must NOT depend on the live fiat map.
    const getFiatSnapshot = (k: string) => store.get(cell(asCtx, k));
    const getMetaSnapshot = (k: string) => store.get(metaCell(asCtx, k));
    const reprojected = projectHomeDisplayIds({
      orderedIds: structureAfterRound2.orderedIds,
      smallBalanceIds: structureAfterRound2.smallBalanceIds,
      nonZeroIds: structureAfterRound2.nonZeroIds,
      searchKey: '',
      sortType: ETokenListSortType.Value,
      sortDirection: 'desc',
      hideZero: false,
      getFiat: getFiatSnapshot,
      getMeta: getMetaSnapshot,
    });
    // b(999) now outranks a(1) — the order CAN differ on a fiat tick, proving
    // the structure-only memo deps are what keep the list stable.
    expect(reprojected).toEqual(['b', 'a']);
  });
});
