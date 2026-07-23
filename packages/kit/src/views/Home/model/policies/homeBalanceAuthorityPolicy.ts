import BigNumber from 'bignumber.js';

import type { IHomeBalanceAggregationResult } from '../balance/homeBalanceAggregation';
import type { IHomeConfirmedBalanceRecord } from '../cache/homeConfirmedBalanceCacheReducer';
import type { IHomePortfolioPresentation } from '../semantic/homeSemanticTypes';

const fundedActions = ['send', 'receive', 'buySell', 'swap'] as const;
const zeroActions = ['addMoney', 'receive', 'more'] as const;

type IHomeBalanceAuthorityDecision = {
  cacheCommit?: IHomeConfirmedBalanceRecord;
  presentation: IHomePortfolioPresentation;
};

function confirmedPresentation({
  bannerAvailable,
  record,
  refresh,
}: {
  bannerAvailable: boolean;
  record: IHomeConfirmedBalanceRecord;
  refresh: 'refreshing' | 'failed';
}): IHomePortfolioPresentation {
  if (new BigNumber(record.amount).isZero()) {
    return {
      kind: 'zero',
      header: {
        kind: 'zero',
        balance: {
          amount: record.amount,
          currency: record.quoteBasis.currency,
        },
      },
      actions: { kind: 'zero', items: zeroActions },
      banner: { kind: 'none' },
      freshness: 'confirmedCache',
      refresh,
    };
  }
  return {
    kind: 'funded',
    header: {
      kind: 'funded',
      authority: 'confirmedCache',
      balance: {
        amount: record.amount,
        currency: record.quoteBasis.currency,
      },
    },
    actions: { kind: 'funded', items: fundedActions },
    banner: bannerAvailable ? { kind: 'positive' } : { kind: 'none' },
    freshness: 'confirmedCache',
    refresh,
  };
}

function projectHomeBalanceAuthority({
  aggregation,
  bannerAvailable,
  confirmed,
  confirmedAt,
}: {
  aggregation: IHomeBalanceAggregationResult;
  bannerAvailable: boolean;
  confirmed?: IHomeConfirmedBalanceRecord;
  confirmedAt: number;
}): IHomeBalanceAuthorityDecision {
  if (aggregation.kind === 'loading') {
    if (confirmed) {
      return {
        presentation: confirmedPresentation({
          bannerAvailable,
          record: confirmed,
          refresh: 'refreshing',
        }),
      };
    }
    if (aggregation.positiveEvidence) {
      return {
        presentation: {
          kind: 'fundedPendingTotal',
          header: { kind: 'loading' },
          actions: { kind: 'funded', items: fundedActions },
          banner: bannerAvailable ? { kind: 'positive' } : { kind: 'none' },
        },
      };
    }
    return {
      presentation: {
        kind: 'loading',
        header: { kind: 'loading' },
        actions: { kind: 'loading', items: [] },
        banner: { kind: 'none' },
      },
    };
  }

  if (aggregation.kind === 'error') {
    return {
      presentation: confirmed
        ? confirmedPresentation({
            bannerAvailable,
            record: confirmed,
            refresh: 'failed',
          })
        : {
            kind: 'unavailable',
            header: { kind: 'unavailable', reason: 'sourceError' },
            actions: { kind: 'loading', items: [] },
            banner: { kind: 'none' },
          },
    };
  }

  const { aggregate } = aggregation;
  const cacheCommit: IHomeConfirmedBalanceRecord = {
    amount: aggregate.amount,
    confirmedAt,
    coverageFingerprint: aggregate.coverageFingerprint,
    ownerScopeKey: aggregate.ownerScopeKey,
    quality: 'confirmed',
    quoteBasis: aggregate.quoteBasis,
    sourceKeyIdentity: aggregate.sourceKeyIdentity,
  };
  if (new BigNumber(aggregate.amount).isZero()) {
    return {
      cacheCommit,
      presentation: {
        kind: 'zero',
        header: {
          kind: 'zero',
          balance: {
            amount: aggregate.amount,
            currency: aggregate.quoteBasis.currency,
          },
        },
        actions: { kind: 'zero', items: zeroActions },
        banner: { kind: 'none' },
        freshness: 'live',
        refresh: 'idle',
      },
    };
  }
  return {
    cacheCommit,
    presentation: {
      kind: 'funded',
      header: {
        kind: 'funded',
        authority: 'live',
        balance: {
          amount: aggregate.amount,
          currency: aggregate.quoteBasis.currency,
        },
      },
      actions: { kind: 'funded', items: fundedActions },
      banner: bannerAvailable ? { kind: 'positive' } : { kind: 'none' },
      freshness: 'live',
      refresh: 'idle',
    },
  };
}

export { projectHomeBalanceAuthority };
export type { IHomeBalanceAuthorityDecision };
