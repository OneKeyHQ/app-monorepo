import { projectHomeCapabilities } from '../capabilities/homeCapabilityPolicy';
import { createIdleHomeSourceFacts } from '../facts/homeFacts';
import { projectHomePortfolioPresentation } from '../policies/homePortfolioPolicy';
import { projectHomeSection } from '../policies/homeSectionPolicy';

import type { IHomeFacts } from '../facts/homeFacts';

function facts(): IHomeFacts {
  return {
    owner: {
      walletId: 'wallet-a',
      accountId: 'account-a',
      network: { kind: 'allNetworks' },
    },
    ownerToken: { scopeKey: 'scope-a', sessionId: 'session-a' },
    wallet: {
      ready: true,
      hasNetworkAccount: true,
      backupStatus: 'complete',
      accountType: 'hd',
    },
    environment: { currency: 'USD', theme: 'light' },
    runtime: {
      topology: 'single',
      connection: 'ready',
      producerInstanceId: 'producer-a',
      protocolVersion: 1,
    },
    capabilityInputs: {
      ready: true,
      networkFamily: 'allNetworks',
      accountType: 'hd',
      allNetworks: true,
      serverConfig: {
        perps: false,
        defi: false,
        nft: false,
        history: true,
        market: true,
      },
      productAvailability: {
        perps: false,
        defi: false,
        nft: false,
        history: true,
        market: true,
      },
    },
    sources: createIdleHomeSourceFacts(),
    confirmed: {},
  };
}

describe('Home semantic invariants', () => {
  it('never turns partial positive evidence plus confirmed zero into zero UI', () => {
    const input = facts();
    input.sources.portfolio = {
      kind: 'partial',
      data: {
        amount: '15',
        currency: 'USD',
        positiveEvidence: true,
        requiredSetRevision: 'required-1',
      },
      coverageFingerprint: 'partial-positive',
    };
    input.confirmed.portfolio = {
      sourceId: 'portfolio',
      sourceKeyIdentity: 'source-key-a',
      coverageFingerprint: 'confirmed-zero',
      confirmedAt: 1,
      data: {
        amount: '0',
        currency: 'USD',
        positiveEvidence: false,
        requiredSetRevision: 'required-0',
      },
    };
    const result = projectHomePortfolioPresentation(input);
    expect(result.kind).toBe('fundedPendingTotal');
    expect(result.header.kind).toBe('loading');
    expect(result.actions.kind).toBe('funded');
  });

  it('requires complete coverage before authoritative zero', () => {
    const input = facts();
    expect(projectHomePortfolioPresentation(input).kind).toBe('loading');
    input.sources.portfolio = {
      kind: 'complete',
      result: { kind: 'empty' },
      coverageFingerprint: 'complete-zero',
    };
    expect(projectHomePortfolioPresentation(input).kind).toBe('zero');
  });

  it('keeps partial sections loading and hidden sections row-free', () => {
    expect(
      projectHomeSection({
        applicable: true,
        id: 'nft',
        resource: {
          kind: 'partial',
          data: { rows: [{ id: 'nft-a' }] },
          coverageFingerprint: 'partial',
        },
      }),
    ).toEqual({ kind: 'loading', placeholder: 'nft' });
    expect(
      projectHomeSection({
        applicable: false,
        id: 'nft',
        resource: {
          kind: 'complete',
          result: { kind: 'success', data: { rows: [{ id: 'nft-a' }] } },
          coverageFingerprint: 'complete',
        },
      }),
    ).toEqual({ kind: 'hidden', reason: 'notApplicable' });
  });

  it('always selects a tab contained in the non-empty ready tab set', () => {
    const projection = projectHomeCapabilities({
      facts: facts(),
      selectedTabId: 'defi',
    });
    expect(projection.navigation.kind).toBe('ready');
    if (projection.navigation.kind === 'ready') {
      expect(projection.navigation.tabs).toContain(
        projection.navigation.selectedTabId,
      );
      expect(projection.navigation.tabs.length).toBeGreaterThan(0);
    }
  });
});
