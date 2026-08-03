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
      coverageFingerprint: buildHomePerpsCoverage(),
      data,
      rowIds: ['perps'],
    };

    expect(
      projectHomePerpsSectionSource({
        authorityReady: false,
        scopeMatches: true,
        evidence: completeEvidence,
      }),
    ).toEqual({ kind: 'loading' });
    expect(
      projectHomePerpsSectionSource({
        authorityReady: true,
        scopeMatches: false,
        evidence: {
          kind: 'confirmedCache',
          data,
          rowIds: ['perps'],
          refresh: 'idle',
        },
      }),
    ).toEqual({ kind: 'loading' });
  });

  it('maps confirmed cache to a seed event and preserves the payload reference', () => {
    const identity = createIdentity();
    const data = payload('cached');
    const snapshot = projectHomePerpsSectionSource({
      authorityReady: true,
      scopeMatches: true,
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
      priority: 0,
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
        evidence: {
          kind: 'complete',
          confirmedEmpty: true,
          coverageFingerprint: buildHomePerpsCoverage(),
          data: undefined,
          rowIds: [],
        },
      }),
    ).toEqual({
      kind: 'complete',
      coverageFingerprint: buildHomePerpsCoverage(),
      result: { kind: 'empty' },
    });
    expect(
      projectHomePerpsSectionSource({
        authorityReady: true,
        scopeMatches: true,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomePerpsCoverage(),
          data,
          rowIds: ['perps-a', 'perps-b'],
        },
      }),
    ).toEqual({
      kind: 'complete',
      coverageFingerprint: buildHomePerpsCoverage(),
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
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomePerpsCoverage(),
          data: undefined,
          rowIds: ['perps'],
        },
      }),
    ).toEqual({ kind: 'loading' });
    expect(
      projectHomePerpsSectionSource({
        authorityReady: true,
        scopeMatches: true,
        evidence: {
          kind: 'complete',
          confirmedEmpty: false,
          coverageFingerprint: buildHomePerpsCoverage(),
          data,
          rowIds: [],
        },
      }),
    ).toEqual({ kind: 'loading' });
  });

  it('keeps network rows during refresh states', () => {
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
          coverageFingerprint: buildHomePerpsCoverage(),
          result: { kind: 'success', data: live, rowIds: ['perps'] },
        },
      }),
    );
    expect(
      coordinator.dispatch(
        adaptHomePerpsSourceSnapshot({
          identity,
          snapshot: { kind: 'loading' },
        }),
      ),
    ).toMatchObject({
      semantic: {
        kind: 'ready',
        priority: 1,
        refresh: 'refreshing',
      },
      authoritative: { kind: 'live', data: live },
    });
    expect(
      coordinator.dispatch(
        adaptHomePerpsSourceSnapshot({
          identity,
          snapshot: {
            kind: 'partial',
            coverageFingerprint: 'perps:partial',
          },
        }),
      ),
    ).toMatchObject({
      semantic: {
        kind: 'ready',
        priority: 1,
        refresh: 'refreshing',
      },
    });
    expect(
      coordinator.dispatch(
        adaptHomePerpsSourceSnapshot({
          identity,
          snapshot: {
            kind: 'error',
            errorKind: 'transport',
          },
        }),
      ),
    ).toMatchObject({
      semantic: {
        kind: 'ready',
        priority: 1,
        refresh: 'failed',
      },
    });
  });

  it('accepts later same-source responses but rejects a different owner', () => {
    const identity = createIdentity();
    const coordinator = new HomeSectionCoordinator<IHomePerpsLegacyPayload>(
      identity,
    );
    const current = payload('current');
    const later = payload('later');

    coordinator.dispatch(
      adaptHomePerpsSourceSnapshot({
        identity,
        snapshot: {
          kind: 'complete',
          coverageFingerprint: buildHomePerpsCoverage(),
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
            coverageFingerprint: buildHomePerpsCoverage(),
            result: {
              kind: 'success',
              data: later,
              rowIds: ['perps'],
            },
          },
        }),
      ),
    ).toMatchObject({ accepted: true });

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
            coverageFingerprint: buildHomePerpsCoverage(),
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
      data: later,
    });
  });
});
