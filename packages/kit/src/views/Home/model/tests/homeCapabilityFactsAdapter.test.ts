import { adaptCurrentHomeCapabilityFacts } from '../capabilities/currentHomeCapabilityFactsAdapter';

const base = {
  accountType: 'hd' as const,
  allNetworks: true,
  expectedSourceScopeKey: 'scope-1',
  isReady: true,
  networkFamily: 'allNetworks' as const,
  ownerToken: { scopeKey: 'scope-1', sessionId: 'session-1' },
  perpsDestination: 'inline' as const,
  productAvailability: {
    defi: true,
    history: true,
    market: true,
    nft: true,
    perps: true,
  },
  serverConfig: {
    defi: true,
    history: true,
    market: true,
    nft: true,
    perps: true,
  },
  sourceRevision: 'revision-1',
  sourceScopeKey: 'scope-1',
};

describe('currentHomeCapabilityFactsAdapter', () => {
  it('keeps unknown readiness pending instead of guessing support', () => {
    expect(
      adaptCurrentHomeCapabilityFacts({ ...base, isReady: false }).resource,
    ).toEqual({ kind: 'loading' });
    expect(
      adaptCurrentHomeCapabilityFacts({
        ...base,
        sourceScopeKey: 'another-scope',
      }).resource,
    ).toEqual({ kind: 'loading' });
    expect(
      adaptCurrentHomeCapabilityFacts({
        ...base,
        accountType: 'unknown',
      }).resource,
    ).toEqual({ kind: 'loading' });
  });

  it('publishes complete explicit capability evidence for the exact scope', () => {
    expect(adaptCurrentHomeCapabilityFacts(base).resource).toMatchObject({
      kind: 'complete',
      context: {
        accountType: 'hd',
        allNetworks: true,
        perpsDestination: 'inline',
        productAvailability: { perps: 'available' },
        serverConfig: { perps: 'available' },
      },
    });
  });

  it('keeps account/network capability scope in the exact cache identity', () => {
    expect(adaptCurrentHomeCapabilityFacts(base).sourceKeyIdentity).not.toBe(
      adaptCurrentHomeCapabilityFacts({
        ...base,
        expectedSourceScopeKey: 'scope-2',
        sourceScopeKey: 'scope-2',
      }).sourceKeyIdentity,
    );
  });
});
