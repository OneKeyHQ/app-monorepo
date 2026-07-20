import {
  adaptCurrentHomeBalanceFacts,
  buildHomeBalanceQuoteRateIdentity,
  resolveHomeBalanceQuoteAwareSourceStatus,
  resolveHomeBalanceQuotedAmount,
  selectHomePortfolioWorth,
} from '../facts/currentHomeBalanceFactsAdapter';

const ownerToken = { scopeKey: 'wallet:account:all', sessionId: 'session-1' };
const quoteBasis = { currency: 'usd', pricingRevision: 'rates-1' };

describe('currentHomeBalanceFactsAdapter', () => {
  it('builds an exact owner, required-set, and quote-bound source identity', () => {
    const facts = adaptCurrentHomeBalanceFacts({
      bannerAvailable: true,
      compatibilityConfirmedAmount: '12',
      contributors: [
        {
          amount: '10',
          coverageFingerprint: 'portfolio-complete',
          expectedSourceScopeKey: 'scope-1',
          id: 'portfolio',
          included: true,
          positiveEvidence: true,
          sourceIdentity: 'portfolio-v1',
          sourceScopeKey: 'scope-1',
          status: 'success',
        },
        {
          amount: '2',
          coverageFingerprint: 'defi-complete',
          expectedSourceScopeKey: 'scope-1',
          id: 'defi',
          included: true,
          positiveEvidence: true,
          sourceIdentity: 'defi-v1',
          sourceScopeKey: 'scope-1',
          status: 'success',
        },
        {
          expectedSourceScopeKey: 'scope-1',
          id: 'perps',
          included: false,
          positiveEvidence: false,
          sourceIdentity: 'perps-v1',
          status: 'idle',
        },
      ],
      ownerToken,
      quoteBasis,
      requiredSetRevision: 'portfolio+defi:v1',
    });

    expect(facts.requiredContributors).toEqual(['defi', 'portfolio']);
    expect(facts.contributors.portfolio?.resource.kind).toBe('complete');
    expect(facts.compatibilityConfirmed).toMatchObject({
      amount: '12',
      ownerScopeKey: ownerToken.scopeKey,
      quoteBasis,
      sourceKeyIdentity: facts.sourceKeyIdentity,
    });
  });

  it('turns a stale source scope into loading instead of accepting its value', () => {
    const facts = adaptCurrentHomeBalanceFacts({
      bannerAvailable: false,
      contributors: [
        {
          amount: '99',
          expectedSourceScopeKey: 'scope-current',
          id: 'portfolio',
          included: true,
          positiveEvidence: true,
          sourceIdentity: 'portfolio-v1',
          sourceScopeKey: 'scope-old',
          status: 'success',
        },
      ],
      ownerToken,
      quoteBasis,
      requiredSetRevision: 'portfolio:v1',
    });

    expect(facts.contributors.portfolio?.resource).toEqual({ kind: 'loading' });
  });

  it('does not seed a non-finite compatibility balance', () => {
    const facts = adaptCurrentHomeBalanceFacts({
      bannerAvailable: false,
      compatibilityConfirmedAmount: 'NaN',
      contributors: [
        {
          expectedSourceScopeKey: 'scope-1',
          id: 'portfolio',
          included: true,
          positiveEvidence: false,
          sourceIdentity: 'portfolio-v1',
          sourceScopeKey: 'scope-1',
          status: 'loading',
        },
      ],
      ownerToken,
      quoteBasis,
      requiredSetRevision: 'portfolio:v1',
    });

    expect(facts.compatibilityConfirmed).toBeUndefined();
  });

  it('never relabels an amount as USD while its quote rate is unavailable', () => {
    expect(
      resolveHomeBalanceQuotedAmount({
        currencyMap: { usd: { value: '1' } },
        sourceCurrency: 'cny',
        targetCurrency: 'usd',
        value: '350',
      }),
    ).toBeUndefined();
    expect(
      resolveHomeBalanceQuotedAmount({
        currencyMap: { cny: { value: '7' }, usd: { value: '1' } },
        sourceCurrency: 'cny',
        targetCurrency: 'usd',
        value: '350',
      }),
    ).toMatchObject({ amount: '50' });
    expect(
      buildHomeBalanceQuoteRateIdentity({
        currencyMap: { cny: { value: '7.1' }, usd: { value: '1' } },
        sourceCurrency: 'cny',
        targetCurrency: 'usd',
      }),
    ).not.toBe(
      buildHomeBalanceQuoteRateIdentity({
        currencyMap: { cny: { value: '7.2' }, usd: { value: '1' } },
        sourceCurrency: 'cny',
        targetCurrency: 'usd',
      }),
    );
  });

  it('does not relabel a previous network worth as the current single-network scope', () => {
    expect(
      selectHomePortfolioWorth({
        currentWorthKey: 'account-1__network-b',
        usesAggregateWorth: false,
        worth: { 'account-1__network-a': '99' },
      }),
    ).toEqual({ amount: '0', sourcePresent: false });
    expect(
      selectHomePortfolioWorth({
        currentWorthKey: 'account-1__network-b',
        usesAggregateWorth: false,
        worth: {
          'account-1__network-a': '99',
          'account-1__network-b': '3',
        },
      }),
    ).toEqual({ amount: '3', sourcePresent: true });
  });

  it('prevents a raw-success source from committing a partial total when quoting failed', () => {
    expect(
      resolveHomeBalanceQuoteAwareSourceStatus({
        quoteReady: false,
        status: 'success',
      }),
    ).toBe('loading');
    expect(
      resolveHomeBalanceQuoteAwareSourceStatus({
        quoteReady: true,
        status: 'success',
      }),
    ).toBe('success');
    expect(
      resolveHomeBalanceQuoteAwareSourceStatus({
        quoteReady: false,
        status: 'error',
      }),
    ).toBe('error');
  });
});
