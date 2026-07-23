import { projectHomeBalanceAuthority } from '../policies/homeBalanceAuthorityPolicy';

import type { IHomeBalanceAggregationResult } from '../balance/homeBalanceAggregation';
import type { IHomeConfirmedBalanceRecord } from '../cache/homeConfirmedBalanceCacheReducer';

const quoteBasis = { currency: 'usd', pricingRevision: 'rates-1' };
const confirmed: IHomeConfirmedBalanceRecord = {
  amount: '8',
  confirmedAt: 1,
  coverageFingerprint: 'coverage-old',
  ownerScopeKey: 'owner-1',
  quality: 'confirmed',
  quoteBasis,
  sourceKeyIdentity: 'source-1',
};

function complete(amount: string): IHomeBalanceAggregationResult {
  return {
    kind: 'complete',
    aggregate: {
      amount,
      coverageFingerprint: 'coverage-live',
      ownerScopeKey: 'owner-1',
      positiveEvidence: amount !== '0',
      quoteBasis,
      requiredSetRevision: 'required-v1',
      sourceKeyIdentity: 'source-1',
    },
  };
}

function partial({
  amount,
  positiveEvidence = amount !== '0',
  refresh = 'refreshing',
}: {
  amount: string;
  positiveEvidence?: boolean;
  refresh?: 'refreshing' | 'failed';
}): IHomeBalanceAggregationResult {
  return {
    kind: 'partial',
    aggregate: {
      amount,
      coverageFingerprint: 'coverage-partial',
      ownerScopeKey: 'owner-1',
      positiveEvidence,
      quoteBasis,
      requiredSetRevision: 'required-v1',
      sourceKeyIdentity: 'source-1',
    },
    reason: refresh === 'failed' ? 'sourceError' : 'sourcePending',
    refresh,
  };
}

describe('homeBalanceAuthorityPolicy', () => {
  it('does not fabricate zero while loading without an exact record', () => {
    expect(
      projectHomeBalanceAuthority({
        aggregation: {
          kind: 'loading',
          positiveEvidence: false,
          reason: 'sourcePending',
        },
        bannerAvailable: true,
        confirmedAt: 2,
      }).presentation,
    ).toEqual({
      kind: 'loading',
      header: { kind: 'loading' },
      actions: { kind: 'loading', items: [] },
      banner: { kind: 'none' },
    });
  });

  it('keeps the exact confirmed total while positive live evidence refreshes', () => {
    expect(
      projectHomeBalanceAuthority({
        aggregation: {
          kind: 'loading',
          positiveEvidence: true,
          reason: 'sourcePending',
        },
        bannerAvailable: true,
        confirmed,
        confirmedAt: 2,
      }).presentation,
    ).toMatchObject({
      kind: 'funded',
      header: { balance: { amount: confirmed.amount } },
      actions: { kind: 'funded' },
      banner: { kind: 'positive' },
      freshness: 'confirmedCache',
      refresh: 'refreshing',
    });
  });

  it('keeps funded-safe actions without inventing a partial amount when uncached', () => {
    expect(
      projectHomeBalanceAuthority({
        aggregation: {
          kind: 'loading',
          positiveEvidence: true,
          reason: 'sourcePending',
        },
        bannerAvailable: true,
        confirmedAt: 2,
      }).presentation,
    ).toMatchObject({
      kind: 'fundedPendingTotal',
      header: { kind: 'loading' },
      actions: { kind: 'funded' },
    });
  });

  it('exposes a progressive amount without committing it as confirmed', () => {
    const decision = projectHomeBalanceAuthority({
      aggregation: partial({ amount: '10.25', refresh: 'failed' }),
      bannerAvailable: true,
      confirmedAt: 2,
    });

    expect(decision.cacheCommit).toBeUndefined();
    expect(decision.presentation).toMatchObject({
      kind: 'fundedPendingTotal',
      header: {
        balance: { amount: '10.25', currency: 'usd' },
      },
      actions: { kind: 'funded' },
      refresh: 'failed',
    });
  });

  it('keeps an exact cache until progressive data has a usable value', () => {
    expect(
      projectHomeBalanceAuthority({
        aggregation: partial({ amount: '0', positiveEvidence: false }),
        bannerAvailable: false,
        confirmed,
        confirmedAt: 2,
      }).presentation,
    ).toMatchObject({
      kind: 'funded',
      header: { balance: { amount: confirmed.amount } },
      freshness: 'confirmedCache',
      refresh: 'refreshing',
    });
  });

  it('uses exact confirmed data for loading/error without writing cache', () => {
    const loading = projectHomeBalanceAuthority({
      aggregation: {
        kind: 'loading',
        positiveEvidence: false,
        reason: 'sourcePending',
      },
      bannerAvailable: false,
      confirmed,
      confirmedAt: 2,
    });
    expect(loading.cacheCommit).toBeUndefined();
    expect(loading.presentation).toMatchObject({
      kind: 'funded',
      freshness: 'confirmedCache',
      refresh: 'refreshing',
    });

    const error = projectHomeBalanceAuthority({
      aggregation: {
        kind: 'error',
        positiveEvidence: false,
        reason: 'sourceError',
      },
      bannerAvailable: false,
      confirmed,
      confirmedAt: 2,
    });
    expect(error.cacheCommit).toBeUndefined();
    expect(error.presentation).toMatchObject({ refresh: 'failed' });
  });

  it('commits only complete live totals, including authoritative zero', () => {
    const zero = projectHomeBalanceAuthority({
      aggregation: complete('0'),
      bannerAvailable: true,
      confirmed,
      confirmedAt: 3,
    });
    expect(zero.presentation).toMatchObject({
      kind: 'zero',
      freshness: 'live',
    });
    expect(zero.cacheCommit).toMatchObject({
      amount: '0',
      confirmedAt: 3,
      quality: 'confirmed',
    });
    expect(
      projectHomeBalanceAuthority({
        aggregation: complete('-20'),
        bannerAvailable: false,
        confirmedAt: 4,
      }),
    ).toMatchObject({
      cacheCommit: { amount: '-20' },
      presentation: { kind: 'funded' },
    });
  });
});
