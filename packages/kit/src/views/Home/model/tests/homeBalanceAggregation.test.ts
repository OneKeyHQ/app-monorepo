import { aggregateHomeBalanceFacts } from '../balance/homeBalanceAggregation';
import { adaptCurrentHomeBalanceFacts } from '../facts/currentHomeBalanceFactsAdapter';

const ownerToken = { scopeKey: 'wallet:account:all', sessionId: 'session-1' };
const quoteBasis = { currency: 'usd', pricingRevision: 'rates-1' };

function buildFacts({
  defiAmount = '2.75',
  defiStatus = 'success',
  portfolioStatus = 'success',
}: {
  defiAmount?: string;
  defiStatus?: 'loading' | 'partial' | 'success' | 'error';
  portfolioStatus?: 'loading' | 'partial' | 'success' | 'error';
} = {}) {
  return adaptCurrentHomeBalanceFacts({
    bannerAvailable: false,
    contributors: [
      {
        amount: '10.25',
        coverageFingerprint: 'portfolio-complete',
        expectedSourceScopeKey: 'scope-1',
        id: 'portfolio',
        included: true,
        positiveEvidence: portfolioStatus === 'partial',
        sourceIdentity: 'portfolio-v1',
        sourceScopeKey: 'scope-1',
        status: portfolioStatus,
      },
      {
        amount: defiAmount,
        coverageFingerprint: 'defi-complete',
        expectedSourceScopeKey: 'scope-1',
        id: 'defi',
        included: true,
        positiveEvidence: false,
        sourceIdentity: 'defi-v1',
        sourceScopeKey: 'scope-1',
        status: defiStatus,
      },
    ],
    ownerToken,
    quoteBasis,
    requiredSetRevision: 'portfolio+defi:v1',
  });
}

describe('homeBalanceAggregation', () => {
  it('publishes an exact total after every required contributor completes', () => {
    expect(aggregateHomeBalanceFacts(buildFacts())).toMatchObject({
      kind: 'complete',
      aggregate: {
        amount: '13',
        ownerScopeKey: ownerToken.scopeKey,
        quoteBasis,
        requiredSetRevision: 'portfolio+defi:v1',
      },
    });
    expect(
      aggregateHomeBalanceFacts(buildFacts({ defiStatus: 'loading' })),
    ).toMatchObject({
      kind: 'partial',
      aggregate: {
        amount: '10.25',
        positiveEvidence: true,
      },
      reason: 'sourcePending',
      refresh: 'refreshing',
    });
  });

  it('adds reliable partial amounts without marking the total complete', () => {
    expect(
      aggregateHomeBalanceFacts(buildFacts({ portfolioStatus: 'partial' })),
    ).toMatchObject({
      kind: 'partial',
      aggregate: {
        amount: '13',
        positiveEvidence: true,
      },
      reason: 'sourcePending',
      refresh: 'refreshing',
    });
  });

  it('rejects a contributor from another owner session', () => {
    const facts = buildFacts();
    const portfolio = facts.contributors.portfolio;
    expect(portfolio).toBeDefined();
    if (portfolio) {
      facts.contributors.portfolio = {
        ...portfolio,
        ownerToken: { ...ownerToken, sessionId: 'old-session' },
      };
    }
    expect(aggregateHomeBalanceFacts(facts)).toEqual({
      kind: 'error',
      positiveEvidence: false,
      reason: 'identityMismatch',
    });
  });

  it('keeps valid contributions when an independent source fails', () => {
    expect(
      aggregateHomeBalanceFacts(buildFacts({ defiStatus: 'error' })),
    ).toMatchObject({
      kind: 'partial',
      aggregate: {
        amount: '10.25',
        positiveEvidence: true,
      },
      reason: 'sourceError',
      refresh: 'failed',
    });
  });

  it('allows signed DeFi net worth to contribute to the exact total', () => {
    expect(
      aggregateHomeBalanceFacts(buildFacts({ defiAmount: '-2.75' })),
    ).toMatchObject({
      kind: 'complete',
      aggregate: { amount: '7.5' },
    });
  });
});
