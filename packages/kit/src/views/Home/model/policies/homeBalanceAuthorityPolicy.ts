import BigNumber from 'bignumber.js';

import type { IHomeBalanceAggregationResult } from '../balance/homeBalanceAggregation';
import type { IHomeConfirmedBalanceRecord } from '../cache/homeConfirmedBalanceCacheReducer';
import type { IHomePortfolioPresentation } from '../semantic/homeSemanticTypes';

const fundedActions = ['send', 'receive', 'buySell', 'swap'] as const;
const zeroActions = ['addMoney', 'receive', 'more'] as const;

function resolveBannerPresentation(bannerAvailable: boolean) {
  return bannerAvailable
    ? ({ kind: 'positive' } as const)
    : ({ kind: 'none' } as const);
}

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
      banner: resolveBannerPresentation(bannerAvailable),
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
    banner: resolveBannerPresentation(bannerAvailable),
    freshness: 'confirmedCache',
    refresh,
  };
}

function progressivePresentation({
  aggregate,
  bannerAvailable,
  decisivePortfolioIsEmpty,
  refresh,
}: {
  aggregate: Extract<
    IHomeBalanceAggregationResult,
    { kind: 'partial' }
  >['aggregate'];
  bannerAvailable: boolean;
  decisivePortfolioIsEmpty: boolean;
  refresh: 'refreshing' | 'failed';
}): IHomePortfolioPresentation {
  if (new BigNumber(aggregate.amount).isZero() && !aggregate.positiveEvidence) {
    if (decisivePortfolioIsEmpty) {
      return {
        kind: 'zero',
        header: {
          kind: 'zero',
          balance: {
            amount: aggregate.amount,
            currency: aggregate.quoteBasis.currency,
          },
        },
        actions: { kind: 'zero', items: zeroActions },
        banner: resolveBannerPresentation(bannerAvailable),
        refresh,
      };
    }
    return {
      kind: 'loading',
      header: { kind: 'loading' },
      actions: { kind: 'loading', items: [] },
      banner: resolveBannerPresentation(bannerAvailable),
      refresh,
    };
  }
  return {
    kind: 'fundedPendingTotal',
    header: {
      kind: 'loading',
      balance: {
        amount: aggregate.amount,
        currency: aggregate.quoteBasis.currency,
      },
    },
    actions: { kind: 'funded', items: fundedActions },
    banner: resolveBannerPresentation(bannerAvailable),
    refresh,
  };
}

function projectHomeBalanceAuthority({
  aggregation,
  bannerAvailable,
  confirmed,
  confirmedAt,
  decisivePortfolioIsEmpty = false,
}: {
  aggregation: IHomeBalanceAggregationResult;
  bannerAvailable: boolean;
  confirmed?: IHomeConfirmedBalanceRecord;
  confirmedAt: number;
  decisivePortfolioIsEmpty?: boolean;
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
          banner: resolveBannerPresentation(bannerAvailable),
        },
      };
    }
    return {
      presentation: {
        kind: 'loading',
        header: { kind: 'loading' },
        actions: { kind: 'loading', items: [] },
        banner: resolveBannerPresentation(bannerAvailable),
      },
    };
  }

  if (aggregation.kind === 'partial') {
    const progressive = progressivePresentation({
      aggregate: aggregation.aggregate,
      bannerAvailable,
      decisivePortfolioIsEmpty,
      refresh: aggregation.refresh,
    });
    if (
      progressive.kind === 'zero' &&
      confirmed &&
      !new BigNumber(confirmed.amount).isZero()
    ) {
      return {
        presentation: confirmedPresentation({
          bannerAvailable,
          record: confirmed,
          refresh: aggregation.refresh,
        }),
      };
    }
    if (progressive.kind !== 'loading' || !confirmed) {
      return { presentation: progressive };
    }
    return {
      presentation: confirmedPresentation({
        bannerAvailable,
        record: confirmed,
        refresh: aggregation.refresh,
      }),
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
            banner: resolveBannerPresentation(bannerAvailable),
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
        banner: resolveBannerPresentation(bannerAvailable),
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
      banner: resolveBannerPresentation(bannerAvailable),
      freshness: 'live',
      refresh: 'idle',
    },
  };
}

export { projectHomeBalanceAuthority };
export type { IHomeBalanceAuthorityDecision };
