import { adaptHomeLegacySpotSection } from '../compatibility/homeLegacySpotSectionAdapter';
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
  return { ownerKey: 'account-a__all', generation: 1, displayIds: [id] };
}

describe('home Spot section authority', () => {
  it('builds an exact source identity from business parameters only', () => {
    const first = createHomeSpotSourceIdentity({
      owner,
      params,
      producerInstanceId: 'producer-a',
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
    expect(first.sourceKeyIdentity).not.toBe(changed.sourceKeyIdentity);
  });

  it('forces scope and producer mismatches to loading without old rows', () => {
    const data = payload('old');
    expect(
      projectHomeSpotSectionSource<IHomeSpotLegacyPayload>({
        authorityReady: false,
        scopeMatches: true,
        requestSeq: 1,
        evidence: {
          kind: 'confirmedCache',
          data,
          rowIds: data.displayIds,
          refresh: 'idle',
        },
      }),
    ).toEqual({ kind: 'loading', requestSeq: 1 });
    expect(
      projectHomeSpotSectionSource<IHomeSpotLegacyPayload>({
        authorityReady: true,
        scopeMatches: false,
        requestSeq: 1,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: 'complete-old',
          data,
          rowIds: data.displayIds,
        },
      }),
    ).toEqual({ kind: 'loading', requestSeq: 1 });
  });

  it('keeps cold no-cache loading and seeds exact cache losslessly', () => {
    const coordinator = new HomeSectionCoordinator<IHomeSpotLegacyPayload>(
      identity,
    );
    const cold = projectHomeSpotSectionSource<IHomeSpotLegacyPayload>({
      authorityReady: true,
      scopeMatches: true,
      requestSeq: 1,
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
      requestSeq: 2,
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
      freshness: 'confirmedCache',
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
      requestSeq: 1,
      evidence: {
        kind: 'partial',
        coverageFingerprint: buildHomeSpotAllCoverage({
          requestSeq: 1,
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
          requestSeq: 1,
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
      freshness: 'confirmedCache',
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
        requestSeq: 1,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomeSpotSingleCoverage(1),
          data,
          rowIds: data.displayIds,
        },
      }),
    ).toMatchObject({ kind: 'complete', result: { kind: 'success' } });
    expect(
      projectHomeSpotSectionSource<IHomeSpotLegacyPayload>({
        authorityReady: true,
        scopeMatches: true,
        requestSeq: 2,
        evidence: {
          kind: 'complete',
          confirmedEmpty: true,
          coverageFingerprint: buildHomeSpotSingleCoverage(2),
          data: payload('ignored'),
          rowIds: [],
        },
      }),
    ).toMatchObject({ kind: 'complete', result: { kind: 'empty' } });
    expect(
      projectHomeSpotSectionSource<IHomeSpotLegacyPayload>({
        authorityReady: true,
        scopeMatches: true,
        requestSeq: 3,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomeSpotSingleCoverage(3),
          data: payload('transient'),
          rowIds: [],
        },
      }),
    ).toEqual({ kind: 'loading', requestSeq: 3 });
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
          requestSeq: 1,
          coverageFingerprint: buildHomeSpotSingleCoverage(1),
          result: { kind: 'success', data: live, rowIds: live.displayIds },
        },
      }),
    );
    const refreshing = coordinator.dispatch(
      adaptHomeSpotSourceSnapshot({
        identity,
        snapshot: { kind: 'loading', requestSeq: 2 },
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
        snapshot: { kind: 'error', requestSeq: 2, errorKind: 'source' },
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
          snapshot: { kind: 'error', requestSeq: 1, errorKind: 'source' },
        }),
      ),
    ).toMatchObject({ semantic: { kind: 'error' } });
  });

  it('rejects a stale completion and preserves the current payload', () => {
    const coordinator = new HomeSectionCoordinator<IHomeSpotLegacyPayload>(
      identity,
    );
    const current = payload('current');
    coordinator.dispatch(
      adaptHomeSpotSourceSnapshot({
        identity,
        snapshot: {
          kind: 'complete',
          requestSeq: 2,
          coverageFingerprint: buildHomeSpotSingleCoverage(2),
          result: {
            kind: 'success',
            data: current,
            rowIds: current.displayIds,
          },
        },
      }),
    );
    const stale = coordinator.dispatch(
      adaptHomeSpotSourceSnapshot({
        identity,
        snapshot: {
          kind: 'complete',
          requestSeq: 1,
          coverageFingerprint: buildHomeSpotSingleCoverage(1),
          result: {
            kind: 'success',
            data: payload('stale'),
            rowIds: ['stale'],
          },
        },
      }),
    );
    expect(stale).toMatchObject({
      accepted: false,
      staleReason: 'requestStale',
    });
    const snapshot = coordinator.getSnapshot();
    if (snapshot.authoritative.kind === 'live') {
      expect(snapshot.authoritative.data).toBe(current);
    }
  });

  it('keeps gate off content by reference and gate on ready typed payload', () => {
    const content = { render: 'legacy-token-list' };
    expect(adaptHomeLegacySpotSection({ content, enabled: false })).toEqual({
      kind: 'legacy',
      content,
    });
    expect(
      adaptHomeLegacySpotSection({ content, enabled: false }),
    ).toMatchObject({ content });
    expect(adaptHomeLegacySpotSection({ content, enabled: true })).toEqual({
      kind: 'loading',
    });

    const coordinator = new HomeSectionCoordinator<IHomeSpotLegacyPayload>(
      identity,
    );
    const data = payload('ready');
    const resolution = coordinator.dispatch(
      adaptHomeSpotSourceSnapshot({
        identity,
        snapshot: {
          kind: 'complete',
          requestSeq: 1,
          coverageFingerprint: buildHomeSpotSingleCoverage(1),
          result: { kind: 'success', data, rowIds: data.displayIds },
        },
      }),
    );
    const adapted = adaptHomeLegacySpotSection({
      content,
      enabled: true,
      resolution,
    });
    expect(adapted).toMatchObject({
      kind: 'ready',
      content,
      payload: data,
      freshness: 'live',
    });
  });
});
