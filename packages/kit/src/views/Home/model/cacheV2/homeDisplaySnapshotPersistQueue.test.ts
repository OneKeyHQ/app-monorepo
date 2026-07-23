import { createInitialHomeStoreState } from '../store/homeStoreInitialState';

import { HomeDisplaySnapshotPersistQueue } from './homeDisplaySnapshotPersistQueue';
import { homeDisplaySnapshotStorage } from './homeDisplaySnapshotRepository';

import type { IHomeStoreState } from '../store/homeStoreTypes';

jest.mock('./homeDisplaySnapshotRepository', () => ({
  homeDisplaySnapshotStorage: {
    read: jest.fn(async () => undefined),
    readMany: jest.fn(async () => new Map()),
    commit: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
    clearNamespace: jest.fn(async () => undefined),
    compact: jest.fn(async () => undefined),
  },
}));

const mockStorage = homeDisplaySnapshotStorage as jest.Mocked<
  typeof homeDisplaySnapshotStorage
>;
const mockValues = new Map<string, string>();

function createCacheableState(ownerScopeKey: string): IHomeStoreState {
  const initial = createInitialHomeStoreState();
  const token = {
    protocolVersion: 1 as const,
    clientInstanceId: 'client-a',
    producerInstanceId: 'producer-a',
    sessionId: `session:${ownerScopeKey}`,
    requestSeq: 1,
    sourceKey: {
      scopeKey: ownerScopeKey,
      sourceId: 'portfolio' as const,
      paramsFingerprint: 'portfolio',
      dataSchemaVersion: 1,
    },
  };
  return {
    ...initial,
    session: {
      ownerToken: {
        scopeKey: ownerScopeKey,
        sessionId: token.sessionId,
      },
      status: 'ready',
    },
    resources: {
      ...initial.resources,
      portfolio: {
        kind: 'ready',
        token,
        data: {
          section: {
            kind: 'ready',
            rowIds: ['asset-a'],
          },
        },
        coverageFingerprint: '["asset-a"]',
        freshness: 'live',
        refresh: 'idle',
      },
    },
  };
}

function withFundedShell(
  state: IHomeStoreState,
  freshness: 'confirmedCache' | 'live' = 'live',
): IHomeStoreState {
  return {
    ...state,
    shell: {
      ...state.shell,
      value: {
        kind: 'portfolio',
        presentation: {
          kind: 'funded',
          header: {
            kind: 'funded',
            authority: freshness === 'live' ? 'live' : 'confirmedCache',
            balance: { amount: '42.50', currency: 'usd' },
          },
          actions: {
            kind: 'funded',
            items: ['send', 'receive', 'buySell', 'swap'],
          },
          banner: { kind: 'none' },
          freshness,
          refresh: freshness === 'live' ? 'idle' : 'refreshing',
        },
      },
    },
  };
}

describe('HomeDisplaySnapshotPersistQueue', () => {
  beforeEach(() => {
    mockValues.clear();
    mockStorage.read.mockClear();
    mockStorage.commit.mockClear();
    mockStorage.remove.mockClear();
    mockStorage.compact.mockClear();
    mockStorage.read.mockImplementation(async (key) => mockValues.get(key));
    mockStorage.commit.mockImplementation(async (input) => {
      input.entries.forEach(({ key, value }) => mockValues.set(key, value));
      mockValues.set(input.commitMarker.key, input.commitMarker.value);
      input.removeKeys?.forEach((key) => mockValues.delete(key));
    });
    mockStorage.remove.mockImplementation(async (keys) => {
      keys.forEach((key) => mockValues.delete(key));
    });
  });

  it('observes rapid commits but coalesces them into one physical generation', async () => {
    const queue = new HomeDisplaySnapshotPersistQueue();
    const state = createCacheableState('owner-a');
    for (let storeCommitId = 1; storeCommitId <= 100; storeCommitId += 1) {
      queue.enqueue(state, {
        storeCommitId,
        origin: 'storeEvent',
        changedSourceIds: ['portfolio'],
      });
    }
    await queue.flushNow();
    expect(mockStorage.commit.mock.calls).toHaveLength(1);
    const commit = mockStorage.commit.mock.calls[0][0];
    expect(
      commit.entries.some((entry) => entry.key.endsWith('/portfolio')),
    ).toBe(true);
    expect(commit.commitMarker.key).toMatch(/^route\//);
  });

  it('keeps content signatures bounded instead of duplicating chunk payloads in the manifest', async () => {
    const queue = new HomeDisplaySnapshotPersistQueue();
    queue.enqueue(createCacheableState('owner-a'), {
      storeCommitId: 1,
      origin: 'storeEvent',
      changedSourceIds: ['portfolio'],
    });
    await queue.flushNow();

    const manifestEntry = mockStorage.commit.mock.calls[0][0].entries.find(
      ({ key }) => key.startsWith('manifest/'),
    );
    expect(manifestEntry).toBeDefined();
    const manifest = JSON.parse(manifestEntry?.value ?? '{}') as {
      chunks?: {
        portfolio?: {
          contentSignature?: string;
        };
      };
    };
    expect(manifest.chunks?.portfolio?.contentSignature).toHaveLength(64);
  });

  it('keeps pending owner partitions independent and skips hydrate echo writes', async () => {
    const queue = new HomeDisplaySnapshotPersistQueue();
    queue.enqueue(createCacheableState('owner-a'), {
      storeCommitId: 1,
      origin: 'storeEvent',
      changedSourceIds: ['portfolio'],
    });
    queue.enqueue(createCacheableState('owner-b'), {
      storeCommitId: 2,
      origin: 'storeEvent',
      changedSourceIds: ['portfolio'],
    });
    queue.enqueue(createCacheableState('owner-c'), {
      storeCommitId: 3,
      origin: 'cacheHydrate',
      changedSourceIds: ['portfolio'],
    });
    await queue.flushNow();
    expect(mockStorage.commit.mock.calls).toHaveLength(2);
    const routeKeys = mockStorage.commit.mock.calls.map(
      ([commit]) => commit.commitMarker.key,
    );
    expect(new Set(routeKeys).size).toBe(2);
  });

  it('compacts only when a lifecycle boundary requests it', async () => {
    const queue = new HomeDisplaySnapshotPersistQueue();
    queue.enqueue(createCacheableState('owner-a'), {
      storeCommitId: 1,
      origin: 'storeEvent',
      changedSourceIds: ['portfolio'],
    });
    await queue.flushAndCompact();
    expect(mockStorage.commit.mock.calls).toHaveLength(1);
    expect(mockStorage.compact.mock.calls).toHaveLength(1);
  });

  it('defers commits observed during a physical write to the next window', async () => {
    const queue = new HomeDisplaySnapshotPersistQueue();
    const state = createCacheableState('owner-a');
    mockStorage.commit.mockImplementationOnce(async () => {
      queue.enqueue(state, {
        storeCommitId: 2,
        origin: 'storeEvent',
        changedSourceIds: ['portfolio'],
      });
    });
    queue.enqueue(state, {
      storeCommitId: 1,
      origin: 'storeEvent',
      changedSourceIds: ['portfolio'],
    });
    await queue.flushNow();
    expect(mockStorage.commit.mock.calls).toHaveLength(1);
    await queue.flushNow();
    expect(mockStorage.commit.mock.calls).toHaveLength(2);
  });

  it('does not replace a confirmed Header with a pending critical snapshot', async () => {
    const queue = new HomeDisplaySnapshotPersistQueue();
    const fundedState = withFundedShell(createCacheableState('owner-a'));
    queue.enqueue(fundedState, {
      storeCommitId: 1,
      origin: 'storeEvent',
      presentationChanged: true,
    });
    await queue.flushNow();
    const firstCriticalKey = mockStorage.commit.mock.calls[0][0].entries.find(
      ({ key }) => key.endsWith('/critical'),
    )?.key;
    expect(firstCriticalKey).toBeDefined();

    queue.enqueue(
      {
        ...fundedState,
        interaction: {
          ...fundedState.interaction,
          preferredTabId: 'history',
        },
        shell: {
          ...fundedState.shell,
          value: {
            kind: 'portfolio',
            presentation: {
              kind: 'fundedPendingTotal',
              header: { kind: 'loading' },
              actions: {
                kind: 'funded',
                items: ['send', 'receive', 'buySell', 'swap'],
              },
              banner: { kind: 'none' },
            },
          },
        },
      },
      {
        storeCommitId: 2,
        origin: 'storeEvent',
        presentationChanged: true,
      },
    );
    await queue.flushNow();

    expect(mockStorage.commit.mock.calls).toHaveLength(1);
    expect(mockValues.has(firstCriticalKey ?? '')).toBe(true);
  });

  it('does not replace a confirmed Header with an unavailable snapshot', async () => {
    const queue = new HomeDisplaySnapshotPersistQueue();
    const fundedState = withFundedShell(createCacheableState('owner-a'));
    queue.enqueue(fundedState, {
      storeCommitId: 1,
      origin: 'storeEvent',
      presentationChanged: true,
    });
    await queue.flushNow();
    const firstCriticalKey = mockStorage.commit.mock.calls[0][0].entries.find(
      ({ key }) => key.endsWith('/critical'),
    )?.key;
    expect(firstCriticalKey).toBeDefined();

    queue.enqueue(
      {
        ...fundedState,
        shell: {
          ...fundedState.shell,
          value: {
            kind: 'portfolio',
            presentation: {
              kind: 'unavailable',
              header: { kind: 'unavailable', reason: 'sourceError' },
              actions: { kind: 'loading', items: [] },
              banner: { kind: 'none' },
            },
          },
        },
      },
      {
        storeCommitId: 2,
        origin: 'storeEvent',
        presentationChanged: true,
      },
    );
    await queue.flushNow();

    expect(mockStorage.commit.mock.calls).toHaveLength(1);
    expect(mockValues.has(firstCriticalKey ?? '')).toBe(true);
  });

  it('updates live rows while retaining the immutable confirmed Header chunk', async () => {
    const queue = new HomeDisplaySnapshotPersistQueue();
    const fundedState = withFundedShell(createCacheableState('owner-a'));
    queue.enqueue(fundedState, {
      storeCommitId: 1,
      origin: 'storeEvent',
      changedSourceIds: ['portfolio'],
      presentationChanged: true,
    });
    await queue.flushNow();
    const firstCriticalKey = mockStorage.commit.mock.calls[0][0].entries.find(
      ({ key }) => key.endsWith('/critical'),
    )?.key;
    const portfolio = fundedState.resources.portfolio;
    expect(portfolio.kind).toBe('ready');
    if (portfolio.kind !== 'ready') {
      return;
    }

    queue.enqueue(
      {
        ...fundedState,
        interaction: {
          ...fundedState.interaction,
          preferredTabId: 'history',
        },
        resources: {
          ...fundedState.resources,
          portfolio: {
            ...portfolio,
            data: {
              section: {
                kind: 'ready',
                rowIds: ['asset-b'],
              },
            },
            coverageFingerprint: '["asset-b"]',
          },
        },
        shell: {
          ...fundedState.shell,
          value: {
            kind: 'portfolio',
            presentation: {
              kind: 'loading',
              header: { kind: 'loading' },
              actions: { kind: 'loading', items: [] },
              banner: { kind: 'none' },
            },
          },
        },
      },
      {
        storeCommitId: 2,
        origin: 'storeEvent',
        changedSourceIds: ['portfolio'],
        presentationChanged: true,
      },
    );
    await queue.flushNow();

    expect(mockStorage.commit.mock.calls).toHaveLength(2);
    const secondCommit = mockStorage.commit.mock.calls[1][0];
    const manifestEntry = secondCommit.entries.find(({ key }) =>
      key.startsWith('manifest/'),
    );
    const manifest = JSON.parse(manifestEntry?.value ?? '{}') as {
      chunks?: {
        critical?: { key?: string };
        portfolio?: { key?: string };
      };
    };
    expect(manifest.chunks?.critical?.key).toBe(firstCriticalKey);
    expect(manifest.chunks?.portfolio?.key).not.toBeUndefined();
    expect(
      secondCommit.entries.some(({ key }) => key.endsWith('/critical')),
    ).toBe(false);
    expect(mockStorage.remove.mock.calls.flat(2)).not.toContain(
      firstCriticalKey,
    );
  });

  it('does not rewrite unchanged display state as time passes', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    const startedAt = 1_000_000;
    nowSpy.mockReturnValue(startedAt);
    const queue = new HomeDisplaySnapshotPersistQueue();
    const fundedState = withFundedShell(createCacheableState('owner-a'));
    queue.enqueue(fundedState, {
      storeCommitId: 1,
      origin: 'storeEvent',
      changedSourceIds: ['portfolio'],
      presentationChanged: true,
    });
    await queue.flushNow();
    expect(mockStorage.commit.mock.calls).toHaveLength(1);

    nowSpy.mockReturnValue(startedAt + 365 * 24 * 60 * 60 * 1000);
    queue.enqueue(fundedState, {
      storeCommitId: 2,
      origin: 'storeEvent',
      changedSourceIds: ['portfolio'],
    });
    await queue.flushNow();
    nowSpy.mockRestore();

    expect(mockStorage.commit.mock.calls).toHaveLength(1);
  });

  it('removes a confirmed Header when a hard owner state replaces it', async () => {
    const queue = new HomeDisplaySnapshotPersistQueue();
    const fundedState = withFundedShell(createCacheableState('owner-a'));
    queue.enqueue(fundedState, {
      storeCommitId: 1,
      origin: 'storeEvent',
      presentationChanged: true,
    });
    await queue.flushNow();
    const firstCriticalKey = mockStorage.commit.mock.calls[0][0].entries.find(
      ({ key }) => key.endsWith('/critical'),
    )?.key;

    queue.enqueue(
      {
        ...fundedState,
        shell: {
          ...fundedState.shell,
          value: { kind: 'backupRequired', commandId: 'backupWallet' },
        },
      },
      {
        storeCommitId: 2,
        origin: 'storeEvent',
        presentationChanged: true,
      },
    );
    await queue.flushNow();

    const secondCommit = mockStorage.commit.mock.calls[1][0];
    const manifestEntry = secondCommit.entries.find(({ key }) =>
      key.startsWith('manifest/'),
    );
    const manifest = JSON.parse(manifestEntry?.value ?? '{}') as {
      chunks?: { critical?: unknown };
    };
    expect(manifest.chunks?.critical).toBeUndefined();
    expect(mockStorage.remove.mock.calls.flat(2)).toContain(firstCriticalKey);
  });

  it('removes a superseded chunk even after its original manifest retires', async () => {
    const queue = new HomeDisplaySnapshotPersistQueue();
    const initialState: IHomeStoreState = {
      ...createCacheableState('owner-a'),
      interaction: {
        ...createCacheableState('owner-a').interaction,
        preferredTabId: 'portfolio',
      },
    };
    queue.enqueue(initialState, {
      storeCommitId: 1,
      origin: 'storeEvent',
      changedSourceIds: ['portfolio'],
    });
    await queue.flushNow();
    const firstChunkKey = mockStorage.commit.mock.calls[0][0].entries.find(
      ({ key }) => key.endsWith('/portfolio'),
    )?.key;
    expect(firstChunkKey).toBeDefined();

    for (const [index, preferredTabId] of ['defi', 'history'].entries()) {
      queue.enqueue(
        {
          ...initialState,
          interaction: {
            ...initialState.interaction,
            preferredTabId: preferredTabId as 'defi' | 'history',
          },
        },
        {
          storeCommitId: index + 2,
          origin: 'storeEvent',
          presentationChanged: true,
        },
      );
      await queue.flushNow();
    }

    const portfolio = initialState.resources.portfolio;
    expect(portfolio.kind).toBe('ready');
    if (portfolio.kind !== 'ready') {
      return;
    }
    const nextState: IHomeStoreState = {
      ...initialState,
      resources: {
        ...initialState.resources,
        portfolio: {
          ...portfolio,
          data: {
            section: {
              kind: 'ready',
              rowIds: ['asset-b'],
            },
          },
          coverageFingerprint: '["asset-b"]',
        },
      },
    };
    queue.enqueue(nextState, {
      storeCommitId: 4,
      origin: 'storeEvent',
      changedSourceIds: ['portfolio'],
    });
    await queue.flushNow();

    expect(mockStorage.remove.mock.calls.flat(2)).toContain(firstChunkKey);
    expect(mockValues.has(firstChunkKey ?? '')).toBe(false);
  });
});
