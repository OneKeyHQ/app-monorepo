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

function complete(input = identity, rowId = 'row-1') {
  return {
    ...input,
    kind: 'complete' as const,
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
      data,
      rowIds: ['cached-row'],
      refresh: 'refreshing',
    });
    expect(seeded).toMatchObject({
      semantic: {
        kind: 'ready',
        priority: 0,
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
    });
    expect(partial.semantic).toMatchObject({
      kind: 'ready',
      refresh: 'refreshing',
    });
    if (partial.authoritative.kind === 'confirmedCache') {
      expect(partial.authoritative.data).toBe(data);
    }
  });

  it('keeps a confirmed seed while loading', () => {
    const data = { rows: [{ id: 'cached-row' }] };
    const coordinator = new HomeSectionCoordinator<typeof data>(identity);
    coordinator.dispatch({
      ...identity,
      kind: 'seedConfirmed',
      data,
      rowIds: ['cached-row'],
      refresh: 'idle',
    });
    const refreshing = coordinator.dispatch({
      ...identity,
      kind: 'loading',
    });
    expect(refreshing).toMatchObject({
      accepted: true,
      semantic: {
        kind: 'ready',
        priority: 0,
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
      coordinator.dispatch({ ...identity, kind: 'loading' }),
    ).toMatchObject({
      semantic: { kind: 'loading' },
      authoritative: { kind: 'none' },
    });
    expect(
      coordinator.dispatch({
        ...identity,
        kind: 'partial',
      }),
    ).toMatchObject({
      semantic: { kind: 'loading' },
      authoritative: { kind: 'none' },
    });
  });

  it('keeps exact network data over later cache and refresh events', () => {
    const coordinator = new HomeSectionCoordinator<IData>(identity);
    const live = complete(identity);
    coordinator.dispatch(live);
    expect(
      coordinator.dispatch({
        ...identity,
        kind: 'seedConfirmed',
        data: { rows: [{ id: 'cached-row' }] },
        rowIds: ['cached-row'],
        refresh: 'idle',
      }),
    ).toMatchObject({
      semantic: { kind: 'ready', priority: 1 },
      authoritative: { kind: 'live', data: live.result.data },
    });
    expect(
      coordinator.dispatch({ ...identity, kind: 'loading' }),
    ).toMatchObject({
      semantic: {
        kind: 'ready',
        priority: 1,
        refresh: 'refreshing',
      },
      authoritative: { kind: 'live', data: live.result.data },
    });
  });

  it('projects complete success and exact cached error without losing payload', () => {
    const coordinator = new HomeSectionCoordinator<IData>(identity);
    expect(coordinator.dispatch(complete())).toMatchObject({
      accepted: true,
      semantic: { kind: 'ready', priority: 1, rowIds: ['row-1'] },
      authoritative: { kind: 'live', data: { rows: [{ id: 'row-1' }] } },
    });
    expect(
      coordinator.dispatch({
        ...identity,
        kind: 'error',
      }),
    ).toMatchObject({
      semantic: {
        kind: 'ready',
        priority: 1,
        refresh: 'failed',
      },
      authoritative: { kind: 'live' },
    });
  });

  it('keeps loading, partial, empty, and uncached error distinct', () => {
    const coordinator = new HomeSectionCoordinator<IData>(identity);
    expect(
      coordinator.dispatch({ ...identity, kind: 'loading' }),
    ).toMatchObject({ semantic: { kind: 'loading' } });
    expect(
      coordinator.dispatch({
        ...identity,
        kind: 'partial',
      }),
    ).toMatchObject({ semantic: { kind: 'loading' } });
    expect(
      coordinator.dispatch({
        ...identity,
        kind: 'complete',
        result: { kind: 'empty' },
      }),
    ).toMatchObject({ semantic: { kind: 'empty' } });
    coordinator.setOwner({ ...identity, sourceKeyIdentity: 'cold-source' });
    expect(
      coordinator.dispatch({
        ...identity,
        sourceKeyIdentity: 'cold-source',
        kind: 'error',
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
      }),
    ).toMatchObject({
      semantic: { kind: 'error' },
      authoritative: { kind: 'none' },
    });
  });

  it('does not revive stale rows after authoritative empty', () => {
    const coordinator = new HomeSectionCoordinator<IData>(identity);
    coordinator.dispatch(complete(identity));
    expect(
      coordinator.dispatch({
        ...identity,
        kind: 'complete',
        result: { kind: 'empty' },
      }),
    ).toMatchObject({ semantic: { kind: 'empty' } });
    expect(
      coordinator.dispatch({
        ...identity,
        kind: 'error',
      }),
    ).toMatchObject({
      semantic: { kind: 'error' },
      authoritative: { kind: 'none' },
    });
  });

  it('keeps exact identity rebinding stable and dispose terminal', () => {
    const coordinator = new HomeSectionCoordinator<IData>(identity);
    const snapshot = coordinator.dispatch(complete(identity));
    coordinator.setOwner({ ...identity });
    expect(coordinator.getSnapshot()).toBe(snapshot);
    coordinator.dispose();
    coordinator.setOwner({ ...identity, sourceRevision: 2 });
    expect(
      coordinator.dispatch(
        complete({ ...identity, sourceRevision: 2 }, 'row-2'),
      ),
    ).toMatchObject({ accepted: false, staleReason: 'disposed' });
    expect(coordinator.getSnapshot()).toBe(snapshot);
  });

  it('rejects stale owner, source, producer, revision, and disposed events', () => {
    const coordinator = new HomeSectionCoordinator<IData>(identity);
    coordinator.dispatch(complete(identity));
    expect(
      coordinator.dispatch(
        complete({ ...identity, owner: { ...owner, sessionId: 'old' } }),
      ),
    ).toMatchObject({ accepted: false, staleReason: 'ownerMismatch' });
    expect(
      coordinator.dispatch(complete({ ...identity, sourceKeyIdentity: 'old' })),
    ).toMatchObject({ accepted: false, staleReason: 'sourceMismatch' });
    expect(
      coordinator.dispatch(
        complete({ ...identity, producerInstanceId: 'old' }),
      ),
    ).toMatchObject({ accepted: false, staleReason: 'producerMismatch' });
    expect(
      coordinator.dispatch(complete({ ...identity, sourceRevision: 0 })),
    ).toMatchObject({ accepted: false, staleReason: 'sourceRevisionStale' });
    coordinator.dispose();
    expect(coordinator.dispatch(complete(identity))).toMatchObject({
      accepted: false,
      staleReason: 'disposed',
    });
  });
});
