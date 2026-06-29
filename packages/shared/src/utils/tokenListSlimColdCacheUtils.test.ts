import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '../consts/jotaiConsts';

import {
  OLD_RENDERED_TOKEN_LIST_CACHE_SCOPED_SUFFIX,
  TOKEN_LIST_SLIM_COLD_CACHE_KEY,
  buildSlimSnapshot,
  purgeOldColdStartFields,
  shouldUseSlim,
} from './tokenListSlimColdCacheUtils';

import type {
  IBuildSlimSnapshotParams,
  ITokenListSlimColdCache,
} from './tokenListSlimColdCacheUtils';
import type { IToken, ITokenFiat } from '../../types/token';

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

describe('buildSlimSnapshot', () => {
  it('packs ids + compactFiat + compactMeta for normal tokens', () => {
    const params: IBuildSlimSnapshotParams = {
      structure: {
        orderedIds: ['a'],
        smallBalanceIds: ['b'],
        aggMembership: {},
        ownerKey: 'acc__net',
        generation: 7,
        smallBalanceFiatValue: '12.34',
      },
      fiatByKey: {
        a: makeFiat({
          balanceParsed: '1.5',
          fiatValue: '100',
          price: 50,
          price24h: 2,
          currency: 'usd',
          // unrelated heavy fields must be dropped from compactFiat
          totalBalance: '999',
        }),
        b: makeFiat({ balanceParsed: '0', fiatValue: '0', price: 1 }),
      },
      aggFiatByKey: {},
      metaByKey: {
        a: makeToken({ symbol: 'AAA' }),
        b: makeToken({ symbol: 'BBB' }),
      },
      currency: 'usd',
    };

    const slim = buildSlimSnapshot(params);

    expect(slim.orderedIds).toEqual(['a']);
    expect(slim.smallBalanceIds).toEqual(['b']);
    expect(slim.gen).toBe(7);
    expect(slim.ownerKey).toBe('acc__net');
    expect(slim.currency).toBe('usd');
    // §6 scalar persisted through (PR-0 enabler)
    expect(slim.smallBalanceFiatValue).toBe('12.34');

    // compactFiat keeps only the slim fields
    expect(slim.compactFiat.a).toEqual({
      balanceParsed: '1.5',
      fiatValue: '100',
      price: 50,
      price24h: 2,
      currency: 'usd',
    });
    expect(
      (slim.compactFiat.a as unknown as Record<string, unknown>).totalBalance,
    ).toBeUndefined();

    expect(slim.compactMeta.a.symbol).toBe('AAA');
    expect(slim.compactMeta.b.symbol).toBe('BBB');
  });

  it('routes aggregate ids through compactAggFiat (per-network), not compactFiat', () => {
    const params: IBuildSlimSnapshotParams = {
      structure: {
        orderedIds: ['aggregate_eth'],
        smallBalanceIds: [],
        aggMembership: { aggregate_eth: ['net1', 'net2'] },
        ownerKey: 'acc__net',
        generation: 1,
      },
      // even if a normal fiat exists under the agg key it must NOT land in
      // compactFiat (agg ids excluded by membership)
      fiatByKey: { aggregate_eth: makeFiat({ fiatValue: '5' }) },
      aggFiatByKey: {
        aggregate_eth: {
          net1: makeFiat({ balanceParsed: '1', fiatValue: '10', price: 10 }),
          net2: makeFiat({ balanceParsed: '2', fiatValue: '20', price: 10 }),
        },
      },
      metaByKey: {
        aggregate_eth: makeToken({ isAggregateToken: true, symbol: 'ETH' }),
      },
      currency: 'usd',
    };

    const slim = buildSlimSnapshot(params);

    expect(slim.compactFiat.aggregate_eth).toBeUndefined();
    expect(slim.compactAggFiat.aggregate_eth.net1.fiatValue).toBe('10');
    expect(slim.compactAggFiat.aggregate_eth.net2.fiatValue).toBe('20');
    expect(slim.compactMeta.aggregate_eth.symbol).toBe('ETH');
  });

  it('skips ids missing fiat/meta without throwing', () => {
    const slim = buildSlimSnapshot({
      structure: {
        orderedIds: ['noFiat', 'noMeta'],
        smallBalanceIds: [],
        aggMembership: {},
        ownerKey: 'o',
        generation: 0,
      },
      fiatByKey: { noMeta: makeFiat({ fiatValue: '3' }) },
      aggFiatByKey: {},
      metaByKey: { noFiat: makeToken() },
      currency: 'usd',
    });

    expect(slim.compactFiat.noFiat).toBeUndefined();
    expect(slim.compactFiat.noMeta?.fiatValue).toBe('3');
    expect(slim.compactMeta.noFiat).toBeDefined();
    expect(slim.compactMeta.noMeta).toBeUndefined();
  });

  it('handles an empty structure', () => {
    const slim = buildSlimSnapshot({
      structure: {
        orderedIds: [],
        smallBalanceIds: [],
        aggMembership: {},
        ownerKey: '',
        generation: -1,
      },
      fiatByKey: {},
      aggFiatByKey: {},
      metaByKey: {},
      currency: 'usd',
    });
    expect(slim.compactFiat).toEqual({});
    expect(slim.compactAggFiat).toEqual({});
    expect(slim.compactMeta).toEqual({});
    expect(slim.gen).toBe(-1);
    // a structure without the scalar defaults to '0' on the bundle (PR-0).
    expect(slim.smallBalanceFiatValue).toBe('0');
  });
});

describe('shouldUseSlim', () => {
  const slim = {
    orderedIds: [],
    smallBalanceIds: [],
    aggMembership: {},
    compactFiat: {},
    compactAggFiat: {},
    compactMeta: {},
    gen: 0,
    ownerKey: 'o',
    currency: 'usd',
  } as ITokenListSlimColdCache;

  it('matches when currency equals the current currency', () => {
    expect(shouldUseSlim(slim, 'usd')).toBe(true);
  });

  it('misses on currency mismatch (no stale-currency paint)', () => {
    expect(shouldUseSlim(slim, 'eur')).toBe(false);
  });

  it('misses on absent bundle', () => {
    expect(shouldUseSlim(undefined, 'usd')).toBe(false);
    expect(shouldUseSlim(null, 'usd')).toBe(false);
  });

  it('misses when either currency is empty', () => {
    expect(shouldUseSlim({ ...slim, currency: '' }, 'usd')).toBe(false);
    expect(shouldUseSlim(slim, '')).toBe(false);
  });
});

describe('purgeOldColdStartFields', () => {
  const oldScopedKey = `store:homeTokenList${OLD_RENDERED_TOKEN_LIST_CACHE_SCOPED_SUFFIX}`;
  const oldScopedKey2 = `store:assetList::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.renderedTokenListCacheAtom}`;
  const newSlimKey = `store:homeTokenList::${TOKEN_LIST_SLIM_COLD_CACHE_KEY}`;
  const unrelatedKey = `store:perps::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActivePositionAtom}`;

  it('deletes every field carrying the old rendered-token-list cache key', () => {
    const snapshot: Record<string, unknown> = {
      [oldScopedKey]: { byOwner: {} },
      [oldScopedKey2]: { byOwner: {} },
      [unrelatedKey]: { foo: 1 },
    };
    const next = purgeOldColdStartFields(snapshot);
    expect(next[oldScopedKey]).toBeUndefined();
    expect(next[oldScopedKey2]).toBeUndefined();
    expect(next[unrelatedKey]).toEqual({ foo: 1 });
  });

  it('NEVER deletes the new slim key (suffix does not match)', () => {
    const snapshot: Record<string, unknown> = {
      [oldScopedKey]: { byOwner: {} },
      [newSlimKey]: { orderedIds: [] },
    };
    const next = purgeOldColdStartFields(snapshot);
    expect(next[oldScopedKey]).toBeUndefined();
    expect(next[newSlimKey]).toEqual({ orderedIds: [] });
  });

  it('does not mutate the input object', () => {
    const snapshot: Record<string, unknown> = { [oldScopedKey]: { x: 1 } };
    const next = purgeOldColdStartFields(snapshot);
    expect(snapshot[oldScopedKey]).toEqual({ x: 1 });
    expect(next[oldScopedKey]).toBeUndefined();
  });

  it('returns an empty object for an empty snapshot', () => {
    expect(purgeOldColdStartFields({})).toEqual({});
  });
});
