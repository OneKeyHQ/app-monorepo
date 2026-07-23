import BigNumber from 'bignumber.js';

import type {
  IHomeBalanceContributorFact,
  IHomeBalanceContributorId,
  IHomeBalanceFacts,
  IHomeBalanceQuoteBasis,
} from '../facts/homeFacts';

type IHomeBalanceAggregationUnavailableReason =
  | 'identityMismatch'
  | 'invalidAmount'
  | 'sourceError';

type IHomeBalanceAggregationPendingReason =
  | 'missingContributor'
  | 'sourcePending';

type IHomeBalanceAggregate = {
  amount: string;
  coverageFingerprint: string;
  ownerScopeKey: string;
  positiveEvidence: boolean;
  quoteBasis: IHomeBalanceQuoteBasis;
  requiredSetRevision: string;
  sourceKeyIdentity: string;
};

type IHomeBalanceAggregationResult =
  | {
      kind: 'loading';
      positiveEvidence: boolean;
      reason: IHomeBalanceAggregationPendingReason;
    }
  | {
      kind: 'complete';
      aggregate: IHomeBalanceAggregate;
    }
  | {
      kind: 'error';
      positiveEvidence: boolean;
      reason: IHomeBalanceAggregationUnavailableReason;
    };

function ownersMatch(
  left: IHomeBalanceContributorFact['ownerToken'],
  right: IHomeBalanceContributorFact['ownerToken'],
): boolean {
  return left.scopeKey === right.scopeKey && left.sessionId === right.sessionId;
}

function quoteBasisMatches(
  left: IHomeBalanceQuoteBasis,
  right: IHomeBalanceQuoteBasis,
): boolean {
  return (
    left.currency === right.currency &&
    left.pricingRevision === right.pricingRevision
  );
}

function hasValidIdentity({
  contributor,
  facts,
}: {
  contributor: IHomeBalanceContributorFact;
  facts: IHomeBalanceFacts;
}): boolean {
  return (
    ownersMatch(contributor.ownerToken, facts.ownerToken) &&
    contributor.requiredSetRevision === facts.requiredSetRevision &&
    quoteBasisMatches(contributor.quoteBasis, facts.quoteBasis) &&
    contributor.sourceKeyIdentity.length > 0
  );
}

function uniqueSortedContributorIds(
  ids: readonly IHomeBalanceContributorId[],
): IHomeBalanceContributorId[] | undefined {
  const unique = [...new Set(ids)].toSorted();
  return unique.length === ids.length && unique.length > 0 ? unique : undefined;
}

function aggregateHomeBalanceFacts(
  facts: IHomeBalanceFacts,
): IHomeBalanceAggregationResult {
  const requiredIds = uniqueSortedContributorIds(facts.requiredContributors);
  if (!requiredIds || facts.sourceKeyIdentity.length === 0) {
    return {
      kind: 'error',
      positiveEvidence: false,
      reason: 'identityMismatch',
    };
  }

  let positiveEvidence = false;
  let hasPending = false;
  let pendingReason: IHomeBalanceAggregationPendingReason = 'sourcePending';
  let total = new BigNumber(0);
  const coverage: string[] = [];

  for (const id of requiredIds) {
    const contributor = facts.contributors[id];
    if (!contributor) {
      hasPending = true;
      pendingReason = 'missingContributor';
    } else if (
      contributor.id !== id ||
      !hasValidIdentity({ contributor, facts })
    ) {
      return { kind: 'error', positiveEvidence, reason: 'identityMismatch' };
    } else {
      const resource = contributor.resource;
      if (resource.kind === 'idle' || resource.kind === 'loading') {
        hasPending = true;
      } else if (resource.kind === 'partial') {
        positiveEvidence ||= resource.data.positiveEvidence;
        hasPending = true;
      } else if (resource.kind === 'error') {
        return { kind: 'error', positiveEvidence, reason: 'sourceError' };
      } else {
        coverage.push(`${id}:${resource.coverageFingerprint}`);
        if (resource.result.kind === 'success') {
          positiveEvidence ||= resource.result.data.positiveEvidence;
          const amount = new BigNumber(resource.result.data.amount);
          if (!amount.isFinite()) {
            return {
              kind: 'error',
              positiveEvidence,
              reason: 'invalidAmount',
            };
          }
          total = total.plus(amount);
        }
      }
    }
  }

  if (hasPending) {
    return {
      kind: 'loading',
      positiveEvidence,
      reason: pendingReason,
    };
  }

  return {
    kind: 'complete',
    aggregate: {
      amount: total.toFixed(),
      coverageFingerprint: coverage.join('|'),
      ownerScopeKey: facts.ownerToken.scopeKey,
      positiveEvidence: positiveEvidence || total.isGreaterThan(0),
      quoteBasis: facts.quoteBasis,
      requiredSetRevision: facts.requiredSetRevision,
      sourceKeyIdentity: facts.sourceKeyIdentity,
    },
  };
}

export { aggregateHomeBalanceFacts };
export type {
  IHomeBalanceAggregate,
  IHomeBalanceAggregationResult,
  IHomeBalanceAggregationUnavailableReason,
};
