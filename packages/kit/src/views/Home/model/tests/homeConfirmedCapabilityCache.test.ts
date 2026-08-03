import {
  HOME_CONFIRMED_CAPABILITY_CACHE_LIMIT,
  getHomeConfirmedCapability,
  initialHomeConfirmedCapabilityCacheState,
  reduceHomeConfirmedCapabilityCache,
} from '../capabilities/homeConfirmedCapabilityCache';

import type { IHomeConfirmedCapabilityRecord } from '../capabilities/homeConfirmedCapabilityCache';

function record(index: number): IHomeConfirmedCapabilityRecord {
  return {
    coverageFingerprint: `coverage-${index}`,
    ownerScopeKey: `owner-${index}`,
    sourceKeyIdentity: `source-${index}`,
    value: {
      destinations: { portfolio: 'inline' },
      perpsDestination: 'unavailable',
      revision: `revision-${index}`,
      sections: {
        defi: false,
        history: false,
        market: false,
        nft: false,
        perps: false,
        portfolio: true,
      },
      tabs: ['portfolio'],
    },
  };
}

describe('homeConfirmedCapabilityCache', () => {
  it('matches the exact owner and source identity only', () => {
    const state = reduceHomeConfirmedCapabilityCache(
      initialHomeConfirmedCapabilityCacheState,
      { kind: 'commit', record: record(1) },
    );
    expect(
      getHomeConfirmedCapability(state, {
        ownerScopeKey: 'owner-1',
        sourceKeyIdentity: 'source-1',
      }),
    ).toEqual(record(1));
    expect(
      getHomeConfirmedCapability(state, {
        ownerScopeKey: 'owner-1',
        sourceKeyIdentity: 'source-2',
      }),
    ).toBeUndefined();
  });

  it('keeps an eight-entry LRU and refreshes touched entries', () => {
    let state = initialHomeConfirmedCapabilityCacheState;
    for (
      let index = 0;
      index <= HOME_CONFIRMED_CAPABILITY_CACHE_LIMIT;
      index += 1
    ) {
      state = reduceHomeConfirmedCapabilityCache(state, {
        kind: 'commit',
        record: record(index),
      });
    }
    expect(state.entries).toHaveLength(8);
    expect(state.entries[0].ownerScopeKey).toBe('owner-1');
    state = reduceHomeConfirmedCapabilityCache(state, {
      identity: record(1),
      kind: 'touch',
    });
    expect(state.entries.at(-1)?.ownerScopeKey).toBe('owner-1');
  });
});
