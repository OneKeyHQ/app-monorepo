import { HomeSectionCoordinator } from '../sections/homeSectionCoordinator';
import {
  buildHomeSpotAllCoverage,
  buildHomeSpotSingleCoverage,
  projectHomeSpotSectionSource,
} from '../sections/spot/homeSpotSectionPolicy';
import {
  adaptHomeSpotSourceSnapshot,
  createHomeSpotSourceIdentity,
} from '../sections/spot/homeSpotSourceAdapter';

import type {
  IHomeSpotLegacyPayload,
  IHomeSpotSourceParams,
} from '../sections/spot/homeSpotSourceAdapter';

const owner = { scopeKey: 'scope-a', sessionId: 'session-a' };
const params: IHomeSpotSourceParams = {
  accountOwnerId: 'account-a',
  defaultTokenRevision: 'defaults-1',
  enabledNetworksRevision: 'networks-1',
  mergeDerive: false,
  networkId: 'all',
  networkMode: 'allNetworks',
  tokenMode: 'wallet',
};
const identity = createHomeSpotSourceIdentity({
  owner,
  params,
  producerInstanceId: 'producer-a',
});

function payload(id: string): IHomeSpotLegacyPayload {
  return {
    accountTokensValue: '1',
    aggregateTokenListMap: {},
    allAggregateTokenMap: {},
    displayIds: [id],
    fundedIds: [id],
    generation: 1,
    homeDefaultTokenMap: {},
    isAllNetworkEmptyAccount: false,
    isLpTokenSwitchLoading: false,
    mergeDeriveAddressData: false,
    networksMap: {},
    ownerKey: 'account-a__all',
    riskMap: {},
    riskTokens: [],
    scopedLpTokenList: { keys: '', tokens: [] },
    scopedLpTokenListMap: {},
    scopedLpTokenListState: { initialized: true, isRefreshing: false },
    showLpTokenFilterSwitch: false,
    showLpTokensOnly: false,
    smallBalanceMap: {},
    smallBalanceTokens: [],
    tapTokenMap: {},
    tokenListMap: {},
    tokens: [],
  };
}

describe('home Spot section authority', () => {
  it('builds an exact source identity from business parameters only', () => {
    const first = createHomeSpotSourceIdentity({
      owner,
      params,
      producerInstanceId: 'producer-a',
    });
    const restarted = createHomeSpotSourceIdentity({
      owner: { ...owner, sessionId: 'session-b' },
      params,
      producerInstanceId: 'producer-b',
    });
    const changed = createHomeSpotSourceIdentity({
      owner,
      params: { ...params, defaultTokenRevision: 'defaults-2' },
      producerInstanceId: 'producer-a',
    });
    expect(first).toMatchObject({
      sectionId: 'portfolio',
      sourceId: 'portfolio',
      sourceRevision: 1,
    });
    expect(first.sourceKeyIdentity).toBe(restarted.sourceKeyIdentity);
    expect(first.sourceKeyIdentity).not.toBe(changed.sourceKeyIdentity);
  });

  it('forces scope and producer mismatches to loading without old rows', () => {
    const data = payload('old');
    expect(
      projectHomeSpotSectionSource<IHomeSpotLegacyPayload>({
        authorityReady: false,
        scopeMatches: true,
        evidence: {
          kind: 'confirmedCache',
          data,
          rowIds: data.displayIds,
          refresh: 'idle',
        },
      }),
    ).toEqual({ kind: 'loading' });
    expect(
      projectHomeSpotSectionSource<IHomeSpotLegacyPayload>({
        authorityReady: true,
        scopeMatches: false,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: 'complete-old',
          data,
          rowIds: data.displayIds,
        },
      }),
    ).toEqual({ kind: 'loading' });
  });

  it('keeps cold no-cache loading and seeds exact cache losslessly', () => {
    const coordinator = new HomeSectionCoordinator<IHomeSpotLegacyPayload>(
      identity,
    );
    const cold = projectHomeSpotSectionSource<IHomeSpotLegacyPayload>({
      authorityReady: true,
      scopeMatches: true,
      evidence: { kind: 'loading' },
    });
    expect(
      coordinator.dispatch(
        adaptHomeSpotSourceSnapshot({ identity, snapshot: cold }),
      ),
    ).toMatchObject({ semantic: { kind: 'loading' } });

    const data = payload('cached');
    const confirmed = projectHomeSpotSectionSource<IHomeSpotLegacyPayload>({
      authorityReady: true,
      scopeMatches: true,
      evidence: {
        kind: 'confirmedCache',
        data,
        rowIds: data.displayIds,
        refresh: 'refreshing',
      },
    });
    const resolution = coordinator.dispatch(
      adaptHomeSpotSourceSnapshot({ identity, snapshot: confirmed }),
    );
    expect(resolution.semantic).toMatchObject({
      kind: 'ready',
      priority: 0,
      refresh: 'refreshing',
    });
    if (resolution.authoritative.kind === 'confirmedCache') {
      expect(resolution.authoritative.data).toBe(data);
    }
  });

  it('keeps all-network partial cached rows or loading without cache', () => {
    const noCache = new HomeSectionCoordinator<IHomeSpotLegacyPayload>(
      identity,
    );
    const partial = projectHomeSpotSectionSource<IHomeSpotLegacyPayload>({
      authorityReady: true,
      scopeMatches: true,
      evidence: {
        kind: 'partial',
        coverageFingerprint: buildHomeSpotAllCoverage({
          settled: 1,
          expected: 2,
          failed: 0,
        }),
      },
    });
    expect(
      noCache.dispatch(
        adaptHomeSpotSourceSnapshot({ identity, snapshot: partial }),
      ),
    ).toMatchObject({ semantic: { kind: 'loading' } });

    const withCache = new HomeSectionCoordinator<IHomeSpotLegacyPayload>(
      identity,
    );
    const cached = payload('cached');
    withCache.dispatch(
      adaptHomeSpotSourceSnapshot({
        identity,
        snapshot: {
          kind: 'confirmedCache',
          data: cached,
          rowIds: cached.displayIds,
          refresh: 'refreshing',
        },
      }),
    );
    const resolution = withCache.dispatch(
      adaptHomeSpotSourceSnapshot({ identity, snapshot: partial }),
    );
    expect(resolution.semantic).toMatchObject({
      kind: 'ready',
      priority: 0,
      refresh: 'refreshing',
    });
    if (resolution.authoritative.kind === 'confirmedCache') {
      expect(resolution.authoritative.data).toBe(cached);
    }
  });

  it('projects only confirmed complete success or empty', () => {
    const data = payload('live');
    expect(
      projectHomeSpotSectionSource<IHomeSpotLegacyPayload>({
        authorityReady: true,
        scopeMatches: true,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomeSpotSingleCoverage(),
          data,
          rowIds: data.displayIds,
        },
      }),
    ).toMatchObject({ kind: 'complete', result: { kind: 'success' } });
    expect(
      projectHomeSpotSectionSource<IHomeSpotLegacyPayload>({
        authorityReady: true,
        scopeMatches: true,
        evidence: {
          kind: 'complete',
          confirmedEmpty: true,
          coverageFingerprint: buildHomeSpotSingleCoverage(),
          data: payload('ignored'),
          rowIds: [],
        },
      }),
    ).toMatchObject({ kind: 'complete', result: { kind: 'empty' } });
    expect(
      projectHomeSpotSectionSource<IHomeSpotLegacyPayload>({
        authorityReady: true,
        scopeMatches: true,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomeSpotSingleCoverage(),
          data: payload('transient'),
          rowIds: [],
        },
      }),
    ).toEqual({ kind: 'loading' });
  });

  it('keeps refresh rows stable and handles error with or without cache', () => {
    const coordinator = new HomeSectionCoordinator<IHomeSpotLegacyPayload>(
      identity,
    );
    const live = payload('live');
    coordinator.dispatch(
      adaptHomeSpotSourceSnapshot({
        identity,
        snapshot: {
          kind: 'complete',
          coverageFingerprint: buildHomeSpotSingleCoverage(),
          result: { kind: 'success', data: live, rowIds: live.displayIds },
        },
      }),
    );
    const refreshing = coordinator.dispatch(
      adaptHomeSpotSourceSnapshot({
        identity,
        snapshot: { kind: 'loading' },
      }),
    );
    expect(refreshing.semantic).toMatchObject({
      kind: 'ready',
      rowIds: ['live'],
      refresh: 'refreshing',
    });
    const failed = coordinator.dispatch(
      adaptHomeSpotSourceSnapshot({
        identity,
        snapshot: { kind: 'error', errorKind: 'source' },
      }),
    );
    expect(failed.semantic).toMatchObject({
      kind: 'ready',
      rowIds: ['live'],
      refresh: 'failed',
    });

    const cold = new HomeSectionCoordinator<IHomeSpotLegacyPayload>(identity);
    expect(
      cold.dispatch(
        adaptHomeSpotSourceSnapshot({
          identity,
          snapshot: { kind: 'error', errorKind: 'source' },
        }),
      ),
    ).toMatchObject({ semantic: { kind: 'error' } });
  });

  it('uses the last same-source completion to arrive', () => {
    const coordinator = new HomeSectionCoordinator<IHomeSpotLegacyPayload>(
      identity,
    );
    const current = payload('current');
    coordinator.dispatch(
      adaptHomeSpotSourceSnapshot({
        identity,
        snapshot: {
          kind: 'complete',
          coverageFingerprint: buildHomeSpotSingleCoverage(),
          result: {
            kind: 'success',
            data: current,
            rowIds: current.displayIds,
          },
        },
      }),
    );
    const later = payload('later');
    const resolution = coordinator.dispatch(
      adaptHomeSpotSourceSnapshot({
        identity,
        snapshot: {
          kind: 'complete',
          coverageFingerprint: buildHomeSpotSingleCoverage(),
          result: {
            kind: 'success',
            data: later,
            rowIds: later.displayIds,
          },
        },
      }),
    );
    expect(resolution).toMatchObject({ accepted: true });
    const snapshot = coordinator.getSnapshot();
    if (snapshot.authoritative.kind === 'live') {
      expect(snapshot.authoritative.data).toBe(later);
    }
  });
});
