import {
  HOME_CONFIRMED_BALANCE_CACHE_LIMIT,
  getHomeConfirmedBalance,
  initialHomeConfirmedBalanceCacheState,
  reduceHomeConfirmedBalanceCache,
} from '../cache/homeConfirmedBalanceCacheReducer';

import type {
  IHomeConfirmedBalanceCacheIdentity,
  IHomeConfirmedBalanceRecord,
} from '../cache/homeConfirmedBalanceCacheReducer';

const quoteBasis = { currency: 'usd', pricingRevision: 'rates-1' };

function buildRecord(index: number): IHomeConfirmedBalanceRecord {
  return {
    amount: String(index),
    confirmedAt: index,
    coverageFingerprint: `coverage-${index}`,
    ownerScopeKey: `owner-${index}`,
    quality: 'confirmed',
    quoteBasis,
    sourceKeyIdentity: `source-${index}`,
  };
}

describe('homeConfirmedBalanceCacheReducer', () => {
  it('requires an exact owner, source key, and quote basis match', () => {
    const record = buildRecord(1);
    const state = reduceHomeConfirmedBalanceCache(
      initialHomeConfirmedBalanceCacheState,
      { kind: 'commit', record },
    );
    expect(getHomeConfirmedBalance(state, record)).toBe(record);
    const wrongQuote: IHomeConfirmedBalanceCacheIdentity = {
      ...record,
      quoteBasis: { ...quoteBasis, pricingRevision: 'rates-2' },
    };
    expect(getHomeConfirmedBalance(state, wrongQuote)).toBeUndefined();
    expect(
      getHomeConfirmedBalance(state, {
        ...record,
        ownerScopeKey: 'other-owner',
      }),
    ).toBeUndefined();
  });

  it('keeps a bounded eight-entry LRU and touches exact reads explicitly', () => {
    let state = initialHomeConfirmedBalanceCacheState;
    for (
      let index = 0;
      index < HOME_CONFIRMED_BALANCE_CACHE_LIMIT;
      index += 1
    ) {
      state = reduceHomeConfirmedBalanceCache(state, {
        kind: 'commit',
        record: buildRecord(index),
      });
    }
    state = reduceHomeConfirmedBalanceCache(state, {
      kind: 'touch',
      identity: buildRecord(0),
    });
    state = reduceHomeConfirmedBalanceCache(state, {
      kind: 'commit',
      record: buildRecord(HOME_CONFIRMED_BALANCE_CACHE_LIMIT),
    });

    expect(state.entries).toHaveLength(HOME_CONFIRMED_BALANCE_CACHE_LIMIT);
    expect(getHomeConfirmedBalance(state, buildRecord(0))).toBeDefined();
    expect(getHomeConfirmedBalance(state, buildRecord(1))).toBeUndefined();
  });

  it('rejects non-finite records without mutating state', () => {
    const next = reduceHomeConfirmedBalanceCache(
      initialHomeConfirmedBalanceCacheState,
      {
        kind: 'commit',
        record: { ...buildRecord(1), amount: 'Infinity' },
      },
    );
    expect(next).toBe(initialHomeConfirmedBalanceCacheState);
  });

  it('stores a finite signed aggregate without rejecting DeFi debt', () => {
    const record = { ...buildRecord(1), amount: '-20' };
    const next = reduceHomeConfirmedBalanceCache(
      initialHomeConfirmedBalanceCacheState,
      { kind: 'commit', record },
    );
    expect(getHomeConfirmedBalance(next, record)?.amount).toBe('-20');
  });
});
