import { HomeSectionCoordinator } from '../sections/homeSectionCoordinator';

type IData = { rows: { id: string }[] };

const owner = { scopeKey: 'owner-1', sessionId: 'session-1' };
const identity = {
  owner,
  sectionId: 'portfolio' as const,
  sourceId: 'portfolio' as const,
  sourceKeyIdentity: 'portfolio-source-1',
  producerInstanceId: 'producer-1',
  sourceRevision: 1,
};

function complete(input = identity, requestSeq = 1, rowId = 'row-1') {
  return {
    ...input,
    kind: 'complete' as const,
    requestSeq,
    coverageFingerprint: `coverage-${requestSeq}`,
    result: {
      kind: 'success' as const,
      data: { rows: [{ id: rowId }] },
      rowIds: [rowId],
    },
  };
}

describe('HomeSectionCoordinator', () => {
  it('preserves a main-owned confirmed seed through refresh and partial events', () => {
    const data = {
      rows: [{ id: 'cached-row' }],
      createdAt: new Date(0),
    };
    const coordinator = new HomeSectionCoordinator<typeof data>(identity);
    const seeded = coordinator.dispatch({
      ...identity,
      kind: 'seedConfirmed',
      requestSeq: 1,
      data,
      rowIds: ['cached-row'],
      refresh: 'refreshing',
    });
    expect(seeded).toMatchObject({
      semantic: {
        kind: 'ready',
        freshness: 'confirmedCache',
        refresh: 'refreshing',
      },
      authoritative: { kind: 'confirmedCache' },
    });
    if (seeded.authoritative.kind === 'confirmedCache') {
      expect(seeded.authoritative.data).toBe(data);
    }
    const partial = coordinator.dispatch({
      ...identity,
      kind: 'partial',
      requestSeq: 1,
      coverageFingerprint: 'all:1:1/2:0',
    });
    expect(partial.semantic).toMatchObject({
      kind: 'ready',
      refresh: 'refreshing',
    });
    if (partial.authoritative.kind === 'confirmedCache') {
      expect(partial.authoritative.data).toBe(data);
    }
  });

  it('accepts same-request loading after an idle confirmed seed', () => {
    const data = { rows: [{ id: 'cached-row' }] };
    const coordinator = new HomeSectionCoordinator<typeof data>(identity);
    coordinator.dispatch({
      ...identity,
      kind: 'seedConfirmed',
      requestSeq: 1,
      data,
      rowIds: ['cached-row'],
      refresh: 'idle',
    });
    const refreshing = coordinator.dispatch({
      ...identity,
      kind: 'loading',
      requestSeq: 1,
    });
    expect(refreshing).toMatchObject({
      accepted: true,
      semantic: {
        kind: 'ready',
        freshness: 'confirmedCache',
        refresh: 'refreshing',
      },
      authoritative: { kind: 'confirmedCache' },
    });
    if (refreshing.authoritative.kind === 'confirmedCache') {
      expect(refreshing.authoritative.data).toBe(data);
    }
  });

  it('keeps loading and partial loading when no exact cache exists', () => {
    const coordinator = new HomeSectionCoordinator<IData>(identity);
    expect(
      coordinator.dispatch({ ...identity, kind: 'loading', requestSeq: 1 }),
    ).toMatchObject({
      semantic: { kind: 'loading' },
      authoritative: { kind: 'none' },
    });
    expect(
      coordinator.dispatch({
        ...identity,
        kind: 'partial',
        requestSeq: 1,
        coverageFingerprint: 'all:1:1/2:0',
      }),
    ).toMatchObject({
      semantic: { kind: 'loading' },
      authoritative: { kind: 'none' },
    });
  });

  it('uses an exact live cache while a newer request refreshes', () => {
    const coordinator = new HomeSectionCoordinator<IData>(identity);
    const live = complete(identity, 1);
    coordinator.dispatch(live);
    expect(
      coordinator.dispatch({ ...identity, kind: 'loading', requestSeq: 2 }),
    ).toMatchObject({
      semantic: {
        kind: 'ready',
        freshness: 'confirmedCache',
        refresh: 'refreshing',
      },
      authoritative: { kind: 'confirmedCache', data: live.result.data },
    });
  });

  it('projects complete success and exact cached error without losing payload', () => {
    const coordinator = new HomeSectionCoordinator<IData>(identity);
    expect(coordinator.dispatch(complete())).toMatchObject({
      accepted: true,
      semantic: { kind: 'ready', freshness: 'live', rowIds: ['row-1'] },
      authoritative: { kind: 'live', data: { rows: [{ id: 'row-1' }] } },
    });
    expect(
      coordinator.dispatch({
        ...identity,
        kind: 'error',
        requestSeq: 2,
        errorKind: 'source',
      }),
    ).toMatchObject({
      semantic: {
        kind: 'ready',
        freshness: 'confirmedCache',
        refresh: 'failed',
      },
      authoritative: { kind: 'confirmedCache' },
    });
  });

  it('keeps loading, partial, empty, and uncached error distinct', () => {
    const coordinator = new HomeSectionCoordinator<IData>(identity);
    expect(
      coordinator.dispatch({ ...identity, kind: 'loading', requestSeq: 1 }),
    ).toMatchObject({ semantic: { kind: 'loading' } });
    expect(
      coordinator.dispatch({
        ...identity,
        kind: 'partial',
        requestSeq: 1,
        coverageFingerprint: 'partial',
      }),
    ).toMatchObject({ semantic: { kind: 'loading' } });
    expect(
      coordinator.dispatch({
        ...identity,
        kind: 'complete',
        requestSeq: 2,
        coverageFingerprint: 'empty',
        result: { kind: 'empty' },
      }),
    ).toMatchObject({ semantic: { kind: 'empty' } });
    coordinator.setOwner({ ...identity, sourceKeyIdentity: 'cold-source' });
    expect(
      coordinator.dispatch({
        ...identity,
        sourceKeyIdentity: 'cold-source',
        kind: 'error',
        requestSeq: 1,
        errorKind: 'transport',
      }),
    ).toMatchObject({
      semantic: { kind: 'error' },
      authoritative: { kind: 'none' },
    });
  });

  it('commits cache only after identity validation succeeds', () => {
    const coordinator = new HomeSectionCoordinator<IData>(identity);
    expect(
      coordinator.dispatch(
        complete({ ...identity, sourceKeyIdentity: 'rejected-source' }),
      ),
    ).toMatchObject({ accepted: false, staleReason: 'sourceMismatch' });

    coordinator.setOwner({
      ...identity,
      sourceKeyIdentity: 'rejected-source',
    });
    expect(
      coordinator.dispatch({
        ...identity,
        sourceKeyIdentity: 'rejected-source',
        kind: 'error',
        requestSeq: 1,
        errorKind: 'source',
      }),
    ).toMatchObject({
      semantic: { kind: 'error' },
      authoritative: { kind: 'none' },
    });
  });

  it('does not cache a confirmed seed rejected by exact identity', () => {
    const coordinator = new HomeSectionCoordinator<IData>(identity);
    expect(
      coordinator.dispatch({
        ...identity,
        sourceKeyIdentity: 'rejected-seed',
        kind: 'seedConfirmed',
        requestSeq: 1,
        data: { rows: [{ id: 'rejected' }] },
        rowIds: ['rejected'],
        refresh: 'refreshing',
      }),
    ).toMatchObject({ accepted: false, staleReason: 'sourceMismatch' });
    coordinator.setOwner({ ...identity, sourceKeyIdentity: 'rejected-seed' });
    expect(
      coordinator.dispatch({
        ...identity,
        sourceKeyIdentity: 'rejected-seed',
        kind: 'error',
        requestSeq: 1,
        errorKind: 'source',
      }),
    ).toMatchObject({
      semantic: { kind: 'error' },
      authoritative: { kind: 'none' },
    });
  });

  it('rejects a same-request phase regression after terminal success', () => {
    const coordinator = new HomeSectionCoordinator<IData>(identity);
    const snapshot = coordinator.dispatch(complete(identity, 1));
    expect(
      coordinator.dispatch({ ...identity, kind: 'loading', requestSeq: 1 }),
    ).toMatchObject({ accepted: false, staleReason: 'requestStale' });
    expect(
      coordinator.dispatch({
        ...identity,
        kind: 'error',
        requestSeq: 1,
        errorKind: 'source',
      }),
    ).toMatchObject({ accepted: false, staleReason: 'requestStale' });
    expect(coordinator.getSnapshot()).toBe(snapshot);
  });

  it('does not revive stale rows after authoritative empty', () => {
    const coordinator = new HomeSectionCoordinator<IData>(identity);
    coordinator.dispatch(complete(identity, 1));
    expect(
      coordinator.dispatch({
        ...identity,
        kind: 'complete',
        requestSeq: 2,
        coverageFingerprint: 'empty-2',
        result: { kind: 'empty' },
      }),
    ).toMatchObject({ semantic: { kind: 'empty' } });
    expect(
      coordinator.dispatch({
        ...identity,
        kind: 'error',
        requestSeq: 3,
        errorKind: 'source',
      }),
    ).toMatchObject({
      semantic: { kind: 'error' },
      authoritative: { kind: 'none' },
    });
  });

  it('keeps exact identity rebinding stable and dispose terminal', () => {
    const coordinator = new HomeSectionCoordinator<IData>(identity);
    const snapshot = coordinator.dispatch(complete(identity, 1));
    coordinator.setOwner({ ...identity });
    expect(coordinator.getSnapshot()).toBe(snapshot);
    coordinator.dispose();
    coordinator.setOwner({ ...identity, sourceRevision: 2 });
    expect(
      coordinator.dispatch(
        complete({ ...identity, sourceRevision: 2 }, 2, 'row-2'),
      ),
    ).toMatchObject({ accepted: false, staleReason: 'disposed' });
    expect(coordinator.getSnapshot()).toBe(snapshot);
  });

  it('rejects stale owner, source, producer, revision, request, and disposed events', () => {
    const coordinator = new HomeSectionCoordinator<IData>(identity);
    coordinator.dispatch(complete(identity, 2));
    expect(
      coordinator.dispatch(
        complete({ ...identity, owner: { ...owner, sessionId: 'old' } }, 3),
      ),
    ).toMatchObject({ accepted: false, staleReason: 'ownerMismatch' });
    expect(
      coordinator.dispatch(
        complete({ ...identity, sourceKeyIdentity: 'old' }, 3),
      ),
    ).toMatchObject({ accepted: false, staleReason: 'sourceMismatch' });
    expect(
      coordinator.dispatch(
        complete({ ...identity, producerInstanceId: 'old' }, 3),
      ),
    ).toMatchObject({ accepted: false, staleReason: 'producerMismatch' });
    expect(
      coordinator.dispatch(complete({ ...identity, sourceRevision: 0 }, 3)),
    ).toMatchObject({ accepted: false, staleReason: 'sourceRevisionStale' });
    expect(coordinator.dispatch(complete(identity, 1))).toMatchObject({
      accepted: false,
      staleReason: 'requestStale',
    });
    coordinator.dispose();
    expect(coordinator.dispatch(complete(identity, 3))).toMatchObject({
      accepted: false,
      staleReason: 'disposed',
    });
  });
});
