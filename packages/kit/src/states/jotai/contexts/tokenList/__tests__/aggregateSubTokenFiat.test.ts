/**
 * TokenList cells — UI guard tests for the aggregate sub-token fiat seam
 * (design 2026-06-16 §R2+R3, red-team C-F2 / completeness-#9, BLOCKING).
 *
 * These cover the three migration risks that the deleted `allTokenListMapAtom`
 * read used to serve and that a naive "read the summed aggregate cell" rewrite
 * would silently break:
 *   1. ICON BADGE / network icon — `checkIsOnlyOneTokenHasBalance` must see each
 *      owned sub-token's PER-NETWORK fiat (keyed by the SUB-token `$key`), so it
 *      can detect "exactly one network funded" and pick that network's icon.
 *   2. TOKEN SELECTOR auto-select — same predicate; when exactly one sub-token is
 *      funded the selector auto-selects it instead of opening the sub-list.
 *   3. The aggregate (summed) cell must NOT be the source — it is keyed by the
 *      aggregate `$key` and sums across networks, so it can never resolve a
 *      per-network sub-token `$key` (it would read `undefined` -> count 0).
 *
 * Node + a real jotai `createStore()`, no React. We seed the per-network
 * sub-cells via the projection + valuation apply, then assert the pure builder
 * (`buildAggregateSubTokenFiatAtom`) assembles the right slice and that
 * `checkIsOnlyOneTokenHasBalance` over that slice is correct.
 */
import { createStore } from 'jotai';

import { checkIsOnlyOneTokenHasBalance } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { listStructureAtom } from '../atoms';
import { aggCell, ensureStoreProjection, subcell } from '../cells/projection';
import { buildAggregateSubTokenFiatAtom } from '../cells/useAggregateSubTokenFiatMap';

import type { cell as cellType } from '../cells/projection';

type ICtxStore = Parameters<typeof cellType>[0];

function makeStore(): ICtxStore {
  return createStore() as unknown as ICtxStore;
}

function makeFiat(fiatValue: string): ITokenFiat {
  return {
    balance: fiatValue,
    balanceParsed: fiatValue,
    fiatValue,
    price: 1,
  };
}

const AGG_KEY = 'agg__USDC';
// Two owned sub-tokens of the aggregate, on two networks.
const SUB_ETH: IAccountToken = {
  $key: 'evm--1__usdc',
  address: 'usdc',
  symbol: 'USDC',
  name: 'USD Coin',
  networkId: 'evm--1',
  decimals: 6,
} as IAccountToken;
const SUB_POLY: IAccountToken = {
  $key: 'evm--137__usdc',
  address: 'usdc',
  symbol: 'USDC',
  name: 'USD Coin',
  networkId: 'evm--137',
  decimals: 6,
} as IAccountToken;

const aggregateTokenList = [SUB_ETH, SUB_POLY];

function seedStructure(store: ICtxStore) {
  // The aggCell derives its members off `listStructureAtom.aggMembership`.
  store.set(listStructureAtom(), {
    orderedIds: [AGG_KEY],
    smallBalanceIds: [],
    nonZeroIds: [AGG_KEY],
    fundedIds: [AGG_KEY],
    aggMembership: { [AGG_KEY]: ['evm--1', 'evm--137'] },
    ownerKey: 'acc__net',
    generation: 0,
    smallBalanceFiatValue: '0',
    ownedAggregateTokenListMap: {},
  });
}

describe('buildAggregateSubTokenFiatAtom (icon-badge / auto-select seam)', () => {
  it('assembles per-network sub-token $key -> fiat (NOT the aggregate key)', () => {
    const store = makeStore();
    ensureStoreProjection(store);
    seedStructure(store);
    // Only the ETH sub-token is funded.
    store.set(subcell(store, AGG_KEY, 'evm--1'), makeFiat('5'));
    store.set(subcell(store, AGG_KEY, 'evm--137'), makeFiat('0'));

    const a = buildAggregateSubTokenFiatAtom({
      store,
      aggKey: AGG_KEY,
      aggregateTokenList,
    });
    const map = store.get(a);

    // Keyed by the per-network SUB-token `$key`s.
    expect(map[SUB_ETH.$key]?.fiatValue).toBe('5');
    expect(map[SUB_POLY.$key]?.fiatValue).toBe('0');
    // The aggregate key is NOT in this slice.
    expect(map[AGG_KEY]).toBeUndefined();
  });

  it('icon badge: detects exactly-one-funded so the row picks that network', () => {
    const store = makeStore();
    ensureStoreProjection(store);
    seedStructure(store);
    store.set(subcell(store, AGG_KEY, 'evm--1'), makeFiat('5'));
    store.set(subcell(store, AGG_KEY, 'evm--137'), makeFiat('0'));

    const tokenMap = store.get(
      buildAggregateSubTokenFiatAtom({
        store,
        aggKey: AGG_KEY,
        aggregateTokenList,
      }),
    );

    const { tokenHasBalance, tokenHasBalanceCount } =
      checkIsOnlyOneTokenHasBalance({
        tokenMap,
        aggregateTokenList,
        allAggregateTokenList: [],
      });
    expect(tokenHasBalanceCount).toBe(1);
    expect(tokenHasBalance?.networkId).toBe('evm--1');
  });

  it('TokenSelector auto-select: two funded -> no single auto-select target', () => {
    const store = makeStore();
    ensureStoreProjection(store);
    seedStructure(store);
    store.set(subcell(store, AGG_KEY, 'evm--1'), makeFiat('5'));
    store.set(subcell(store, AGG_KEY, 'evm--137'), makeFiat('3'));

    const tokenMap = store.get(
      buildAggregateSubTokenFiatAtom({
        store,
        aggKey: AGG_KEY,
        aggregateTokenList,
      }),
    );

    const { tokenHasBalance, tokenHasBalanceCount } =
      checkIsOnlyOneTokenHasBalance({
        tokenMap,
        aggregateTokenList,
        allAggregateTokenList: [],
      });
    expect(tokenHasBalanceCount).toBe(2);
    expect(tokenHasBalance).toBeUndefined();
  });

  it('the summed aggCell can NOT serve the per-network check (F2 regression guard)', () => {
    const store = makeStore();
    ensureStoreProjection(store);
    seedStructure(store);
    store.set(subcell(store, AGG_KEY, 'evm--1'), makeFiat('5'));
    store.set(subcell(store, AGG_KEY, 'evm--137'), makeFiat('0'));

    // The aggregate cell sums to 5 but is keyed by the AGGREGATE `$key` only.
    const summed = store.get(aggCell(store, AGG_KEY));
    expect(summed?.fiatValue).toBe('5');

    // Feeding the predicate a map keyed by the aggregate key (what reading the
    // aggCell would produce) resolves NOTHING for the per-network sub-tokens.
    const wrongMap: Record<string, ITokenFiat> = summed
      ? { [AGG_KEY]: summed }
      : {};
    const { tokenHasBalanceCount } = checkIsOnlyOneTokenHasBalance({
      tokenMap: wrongMap,
      aggregateTokenList,
      allAggregateTokenList: [],
    });
    // Wrong source -> 0 funded detected (the bug the C-F2 fix prevents).
    expect(tokenHasBalanceCount).toBe(0);
  });

  it('reactive: a price tick on a sub-cell flows through the derived atom', () => {
    const store = makeStore();
    ensureStoreProjection(store);
    seedStructure(store);
    store.set(subcell(store, AGG_KEY, 'evm--1'), makeFiat('0'));
    store.set(subcell(store, AGG_KEY, 'evm--137'), makeFiat('0'));

    const a = buildAggregateSubTokenFiatAtom({
      store,
      aggKey: AGG_KEY,
      aggregateTokenList,
    });
    expect(store.get(a)[SUB_ETH.$key]?.fiatValue).toBe('0');

    // Tick the ETH sub-cell; the derived atom re-reads it.
    store.set(subcell(store, AGG_KEY, 'evm--1'), makeFiat('9'));
    expect(store.get(a)[SUB_ETH.$key]?.fiatValue).toBe('9');
  });
});
