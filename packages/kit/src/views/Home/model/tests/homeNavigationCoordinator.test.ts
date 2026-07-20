import { projectHomeCapabilitySet } from '../capabilities/homeCapabilityMatrix';
import {
  initialHomeConfirmedCapabilityCacheState,
  reduceHomeConfirmedCapabilityCache,
} from '../capabilities/homeConfirmedCapabilityCache';
import { resolveHomeNavigationCoordinatorState } from '../react/useHomeNavigationCoordinator';

import type { IHomeCapabilityFacts } from '../capabilities/homeCapabilityTypes';

const ownerToken = { scopeKey: 'owner-1', sessionId: 'session-1' };
const context = {
  accountType: 'hd' as const,
  allNetworks: true,
  networkFamily: 'allNetworks' as const,
  perpsDestination: 'web' as const,
  productAvailability: {
    defi: 'available' as const,
    history: 'available' as const,
    market: 'available' as const,
    nft: 'available' as const,
    perps: 'available' as const,
  },
  serverConfig: {
    defi: 'available' as const,
    history: 'available' as const,
    market: 'available' as const,
    nft: 'available' as const,
    perps: 'available' as const,
  },
};

describe('homeNavigationCoordinator', () => {
  it('keeps unknown capability hidden without an exact confirmed record', () => {
    const facts: IHomeCapabilityFacts = {
      ownerToken,
      resource: { kind: 'loading' },
      sourceKeyIdentity: 'source-1',
    };
    expect(
      resolveHomeNavigationCoordinatorState({
        cache: initialHomeConfirmedCapabilityCacheState,
        facts,
        intent: {},
      }).navigation,
    ).toEqual({ kind: 'hidden' });
  });

  it('publishes one correlated navigation state and cache commit', () => {
    const facts: IHomeCapabilityFacts = {
      ownerToken,
      resource: {
        context,
        coverageFingerprint: 'coverage-1',
        kind: 'complete',
      },
      sourceKeyIdentity: 'source-1',
    };
    const result = resolveHomeNavigationCoordinatorState({
      cache: initialHomeConfirmedCapabilityCacheState,
      facts,
      intent: {},
    });
    expect(result.navigation).toMatchObject({
      kind: 'ready',
      perpsDestination: 'web',
      selectedTabId: 'portfolio',
      tabs: projectHomeCapabilitySet(context).tabs,
    });
    expect(result.intent.selectedTabId).toBe('portfolio');
    expect(result.cacheCommand?.kind).toBe('commit');
  });

  it('keeps exact confirmed navigation while the same source refreshes', () => {
    const liveFacts: IHomeCapabilityFacts = {
      ownerToken,
      resource: {
        context,
        coverageFingerprint: 'coverage-1',
        kind: 'complete',
      },
      sourceKeyIdentity: 'source-1',
    };
    const live = resolveHomeNavigationCoordinatorState({
      cache: initialHomeConfirmedCapabilityCacheState,
      facts: liveFacts,
      intent: {},
    });
    expect(live.cacheCommand?.kind).toBe('commit');
    if (live.cacheCommand?.kind !== 'commit') return;
    const cache = reduceHomeConfirmedCapabilityCache(
      initialHomeConfirmedCapabilityCacheState,
      live.cacheCommand,
    );
    const refreshing = resolveHomeNavigationCoordinatorState({
      cache,
      facts: {
        ...liveFacts,
        resource: { kind: 'loading' },
      },
      intent: live.intent,
    });
    expect(refreshing.navigation).toMatchObject({
      freshness: 'confirmedCache',
      kind: 'ready',
      refresh: 'refreshing',
      tabs: ['portfolio', 'perps', 'defi', 'nft', 'history'],
    });
  });

  it('reprojects a Perps kill switch without hiding unrelated tabs', () => {
    const inlineFacts: IHomeCapabilityFacts = {
      ownerToken,
      resource: {
        context: { ...context, perpsDestination: 'inline' },
        coverageFingerprint: 'coverage-inline',
        kind: 'complete',
      },
      sourceKeyIdentity: 'source-1',
    };
    const inline = resolveHomeNavigationCoordinatorState({
      cache: initialHomeConfirmedCapabilityCacheState,
      facts: inlineFacts,
      intent: {},
    });
    const disabled = resolveHomeNavigationCoordinatorState({
      cache: initialHomeConfirmedCapabilityCacheState,
      facts: {
        ...inlineFacts,
        resource: {
          context: {
            ...context,
            perpsDestination: 'unavailable',
            serverConfig: { ...context.serverConfig, perps: 'unavailable' },
          },
          coverageFingerprint: 'coverage-disabled',
          kind: 'complete',
        },
      },
      intent: inline.intent,
    });
    expect(inline.navigation).toMatchObject({
      kind: 'ready',
      tabs: ['portfolio', 'perps', 'defi', 'nft', 'history'],
    });
    expect(disabled.navigation).toMatchObject({
      kind: 'ready',
      tabs: ['portfolio', 'defi', 'nft', 'history'],
    });
  });
});
