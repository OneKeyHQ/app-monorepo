import { adaptHomeLegacyPerpsSection } from '../compatibility/homeLegacyPerpsSectionAdapter';
import { HomeSectionCoordinator } from '../sections/homeSectionCoordinator';
import {
  buildHomePerpsCoverage,
  projectHomePerpsSectionSource,
} from '../sections/perps/homePerpsSectionPolicy';
import {
  HOME_PERPS_SOURCE_REVISION,
  adaptHomePerpsSourceSnapshot,
  createHomePerpsSourceIdentity,
} from '../sections/perps/homePerpsSourceAdapter';

import type {
  IHomePerpsLegacyPayload,
  IHomePerpsSourceParams,
} from '../sections/perps/homePerpsSourceAdapter';

const owner = { scopeKey: 'account:account-a', sessionId: 'session-a' };
const params: IHomePerpsSourceParams = {
  accountScopeKey: 'account:account-a',
  accountId: 'account-a',
  deriveType: 'default',
  indexedAccountId: '',
  networkId: 'evm--42161',
};

function createIdentity() {
  return createHomePerpsSourceIdentity({
    owner,
    params,
    producerInstanceId: 'producer-a',
  });
}

function payload(id: string): IHomePerpsLegacyPayload {
  return {
    address: `0x${id}`,
    scopeKey: owner.scopeKey,
    view: {
      accountValueUsd: 1,
      holdings: [],
      isDegraded: false,
      isEmpty: false,
      positions: [],
    },
  };
}

describe('home Perps section authority', () => {
  it('builds a stable Perps source identity from owner source params and revision', () => {
    const first = createIdentity();
    const same = createIdentity();
    const changedParams = createHomePerpsSourceIdentity({
      owner,
      params: { ...params, deriveType: 'ledger' },
      producerInstanceId: 'producer-a',
    });
    const changedOwner = createHomePerpsSourceIdentity({
      owner: { scopeKey: 'account:account-b', sessionId: 'session-b' },
      params,
      producerInstanceId: 'producer-a',
    });

    expect(first).toEqual(same);
    expect(first).toMatchObject({
      owner,
      sectionId: 'perps',
      sourceId: 'perps',
      producerInstanceId: 'producer-a',
      sourceRevision: HOME_PERPS_SOURCE_REVISION,
    });
    expect(first.sourceKeyIdentity).not.toBe(changedParams.sourceKeyIdentity);
    expect(first.owner).not.toEqual(changedOwner.owner);
    expect(changedOwner.sourceKeyIdentity).not.toBe(first.sourceKeyIdentity);
  });

  it('projects loading when authority is not ready or account scope mismatches', () => {
    const data = payload('old');
    const completeEvidence = {
      kind: 'complete' as const,
      confirmedEmpty: false,
      coverageFingerprint: buildHomePerpsCoverage(1),
      data,
      rowIds: ['perps'],
    };

    expect(
      projectHomePerpsSectionSource({
        authorityReady: false,
        scopeMatches: true,
        requestSeq: 1,
        evidence: completeEvidence,
      }),
    ).toEqual({ kind: 'loading', requestSeq: 1 });
    expect(
      projectHomePerpsSectionSource({
        authorityReady: true,
        scopeMatches: false,
        requestSeq: 2,
        evidence: {
          kind: 'confirmedCache',
          data,
          rowIds: ['perps'],
          refresh: 'idle',
        },
      }),
    ).toEqual({ kind: 'loading', requestSeq: 2 });
  });

  it('maps confirmed cache to a seed event and preserves the payload reference', () => {
    const identity = createIdentity();
    const data = payload('cached');
    const snapshot = projectHomePerpsSectionSource({
      authorityReady: true,
      scopeMatches: true,
      requestSeq: 3,
      evidence: {
        kind: 'confirmedCache',
        data,
        rowIds: ['perps'],
        refresh: 'refreshing',
      },
    });
    const event = adaptHomePerpsSourceSnapshot({ identity, snapshot });

    expect(event).toMatchObject({
      ...identity,
      kind: 'seedConfirmed',
      requestSeq: 3,
      rowIds: ['perps'],
      refresh: 'refreshing',
    });
    if (event.kind === 'seedConfirmed') {
      expect(event.data).toBe(data);
    }

    const coordinator = new HomeSectionCoordinator<IHomePerpsLegacyPayload>(
      identity,
    );
    const resolution = coordinator.dispatch(event);
    expect(resolution.semantic).toEqual({
      kind: 'ready',
      rowIds: ['perps'],
      freshness: 'confirmedCache',
      refresh: 'refreshing',
    });
    expect(resolution.authoritative).toEqual({
      kind: 'confirmedCache',
      data,
    });
  });

  it('projects complete empty and complete success with row IDs', () => {
    const data = payload('live');

    expect(
      projectHomePerpsSectionSource({
        authorityReady: true,
        scopeMatches: true,
        requestSeq: 4,
        evidence: {
          kind: 'complete',
          confirmedEmpty: true,
          coverageFingerprint: buildHomePerpsCoverage(4),
          data: undefined,
          rowIds: [],
        },
      }),
    ).toEqual({
      kind: 'complete',
      requestSeq: 4,
      coverageFingerprint: buildHomePerpsCoverage(4),
      result: { kind: 'empty' },
    });
    expect(
      projectHomePerpsSectionSource({
        authorityReady: true,
        scopeMatches: true,
        requestSeq: 5,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomePerpsCoverage(5),
          data,
          rowIds: ['perps-a', 'perps-b'],
        },
      }),
    ).toEqual({
      kind: 'complete',
      requestSeq: 5,
      coverageFingerprint: buildHomePerpsCoverage(5),
      result: {
        kind: 'success',
        data,
        rowIds: ['perps-a', 'perps-b'],
      },
    });
  });

  it('downgrades incomplete complete evidence without data or row IDs to loading', () => {
    const data = payload('missing-rows');

    expect(
      projectHomePerpsSectionSource({
        authorityReady: true,
        scopeMatches: true,
        requestSeq: 6,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomePerpsCoverage(6),
          data: undefined,
          rowIds: ['perps'],
        },
      }),
    ).toEqual({ kind: 'loading', requestSeq: 6 });
    expect(
      projectHomePerpsSectionSource({
        authorityReady: true,
        scopeMatches: true,
        requestSeq: 7,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomePerpsCoverage(7),
          data,
          rowIds: [],
        },
      }),
    ).toEqual({ kind: 'loading', requestSeq: 7 });
  });

  it('passes error kind through to the coordinator event and cold error semantic', () => {
    const identity = createIdentity();
    const snapshot = projectHomePerpsSectionSource({
      authorityReady: true,
      scopeMatches: true,
      requestSeq: 8,
      evidence: {
        kind: 'error',
        errorKind: 'runtimeUnavailable',
      },
    });
    const event = adaptHomePerpsSourceSnapshot({ identity, snapshot });

    expect(event).toMatchObject({
      ...identity,
      kind: 'error',
      requestSeq: 8,
      errorKind: 'runtimeUnavailable',
    });
    expect(
      new HomeSectionCoordinator<IHomePerpsLegacyPayload>(identity).dispatch(
        event,
      ),
    ).toMatchObject({
      accepted: true,
      semantic: { kind: 'error', errorState: 'perps' },
      authoritative: { kind: 'none' },
    });
  });

  it('keeps cached rows during loading partial and error refresh states', () => {
    const identity = createIdentity();
    const coordinator = new HomeSectionCoordinator<IHomePerpsLegacyPayload>(
      identity,
    );
    const live = payload('live');

    coordinator.dispatch(
      adaptHomePerpsSourceSnapshot({
        identity,
        snapshot: {
          kind: 'complete',
          requestSeq: 1,
          coverageFingerprint: buildHomePerpsCoverage(1),
          result: { kind: 'success', data: live, rowIds: ['perps'] },
        },
      }),
    );
    expect(
      coordinator.dispatch(
        adaptHomePerpsSourceSnapshot({
          identity,
          snapshot: { kind: 'loading', requestSeq: 2 },
        }),
      ),
    ).toMatchObject({
      semantic: {
        kind: 'ready',
        freshness: 'confirmedCache',
        refresh: 'refreshing',
      },
      authoritative: { kind: 'confirmedCache', data: live },
    });
    expect(
      coordinator.dispatch(
        adaptHomePerpsSourceSnapshot({
          identity,
          snapshot: {
            kind: 'partial',
            requestSeq: 3,
            coverageFingerprint: 'perps:3:partial',
          },
        }),
      ),
    ).toMatchObject({
      semantic: {
        kind: 'ready',
        freshness: 'confirmedCache',
        refresh: 'refreshing',
      },
    });
    expect(
      coordinator.dispatch(
        adaptHomePerpsSourceSnapshot({
          identity,
          snapshot: {
            kind: 'error',
            requestSeq: 4,
            errorKind: 'transport',
          },
        }),
      ),
    ).toMatchObject({
      semantic: {
        kind: 'ready',
        freshness: 'confirmedCache',
        refresh: 'failed',
      },
    });
  });

  it('rejects stale terminal and owner responses without A-B-A contamination', () => {
    const identity = createIdentity();
    const coordinator = new HomeSectionCoordinator<IHomePerpsLegacyPayload>(
      identity,
    );
    const current = payload('current');

    coordinator.dispatch(
      adaptHomePerpsSourceSnapshot({
        identity,
        snapshot: {
          kind: 'complete',
          requestSeq: 2,
          coverageFingerprint: buildHomePerpsCoverage(2),
          result: { kind: 'success', data: current, rowIds: ['perps'] },
        },
      }),
    );
    expect(
      coordinator.dispatch(
        adaptHomePerpsSourceSnapshot({
          identity,
          snapshot: {
            kind: 'complete',
            requestSeq: 1,
            coverageFingerprint: buildHomePerpsCoverage(1),
            result: {
              kind: 'success',
              data: payload('stale'),
              rowIds: ['perps'],
            },
          },
        }),
      ),
    ).toMatchObject({ accepted: false, staleReason: 'requestStale' });

    const changedOwnerIdentity = createHomePerpsSourceIdentity({
      owner: { scopeKey: 'account:account-b', sessionId: 'session-b' },
      params: { ...params, accountScopeKey: 'account:account-b' },
      producerInstanceId: 'producer-a',
    });
    expect(
      coordinator.dispatch(
        adaptHomePerpsSourceSnapshot({
          identity: changedOwnerIdentity,
          snapshot: {
            kind: 'complete',
            requestSeq: 3,
            coverageFingerprint: buildHomePerpsCoverage(3),
            result: {
              kind: 'success',
              data: payload('wrong-owner'),
              rowIds: ['perps'],
            },
          },
        }),
      ),
    ).toMatchObject({ accepted: false, staleReason: 'ownerMismatch' });
    expect(coordinator.getSnapshot().authoritative).toEqual({
      kind: 'live',
      data: current,
    });
  });

  it('treats terminal events as final for their request phase', () => {
    const identity = createIdentity();
    const coordinator = new HomeSectionCoordinator<IHomePerpsLegacyPayload>(
      identity,
    );
    const complete = payload('complete');

    expect(
      coordinator.dispatch(
        adaptHomePerpsSourceSnapshot({
          identity,
          snapshot: {
            kind: 'complete',
            requestSeq: 9,
            coverageFingerprint: buildHomePerpsCoverage(9),
            result: {
              kind: 'success',
              data: complete,
              rowIds: ['perps'],
            },
          },
        }),
      ),
    ).toMatchObject({ accepted: true });
    expect(
      coordinator.dispatch(
        adaptHomePerpsSourceSnapshot({
          identity,
          snapshot: {
            kind: 'error',
            requestSeq: 9,
            errorKind: 'transport',
          },
        }),
      ),
    ).toMatchObject({ accepted: false, staleReason: 'requestStale' });
    expect(coordinator.getSnapshot().authoritative).toEqual({
      kind: 'live',
      data: complete,
    });
  });

  it('adapts legacy semantic loading empty error and ready payload reference', () => {
    const identity = createIdentity();
    const coordinator = new HomeSectionCoordinator<IHomePerpsLegacyPayload>(
      identity,
    );

    expect(adaptHomeLegacyPerpsSection({})).toEqual({
      kind: 'loading',
      viewState: 'loading',
    });
    expect(
      adaptHomeLegacyPerpsSection({
        resolution: coordinator.dispatch(
          adaptHomePerpsSourceSnapshot({
            identity,
            snapshot: {
              kind: 'complete',
              requestSeq: 1,
              coverageFingerprint: buildHomePerpsCoverage(1),
              result: { kind: 'empty' },
            },
          }),
        ),
      }),
    ).toEqual({ kind: 'empty', viewState: 'empty' });

    const errorCoordinator =
      new HomeSectionCoordinator<IHomePerpsLegacyPayload>(identity);
    expect(
      adaptHomeLegacyPerpsSection({
        resolution: errorCoordinator.dispatch(
          adaptHomePerpsSourceSnapshot({
            identity,
            snapshot: {
              kind: 'error',
              requestSeq: 1,
              errorKind: 'transport',
            },
          }),
        ),
      }),
    ).toEqual({ kind: 'error', refresh: 'failed', viewState: 'empty' });

    const ready = payload('ready');
    const readyState = adaptHomeLegacyPerpsSection({
      resolution: coordinator.dispatch(
        adaptHomePerpsSourceSnapshot({
          identity,
          snapshot: {
            kind: 'complete',
            requestSeq: 2,
            coverageFingerprint: buildHomePerpsCoverage(2),
            result: { kind: 'success', data: ready, rowIds: ['perps'] },
          },
        }),
      ),
    });

    expect(readyState).toMatchObject({
      kind: 'ready',
      freshness: 'live',
      refresh: 'idle',
      viewState: 'ready',
    });
    if (readyState.kind === 'ready') {
      expect(readyState.payload).toBe(ready);
    }
  });
});
