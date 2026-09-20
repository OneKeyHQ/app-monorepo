const mockCallNativeStorage = jest.fn();
const mockNativeStorageQueueState = jest.fn();
const mockSWRCacheSlowOp = jest.fn();

jest.mock('../../logger/logger', () => ({
  defaultLogger: {
    app: {
      background: {
        nativeStorageQueueState: (params: unknown) => {
          mockNativeStorageQueueState(params);
        },
      },
      perf: {
        swrCacheSlowOp: (params: unknown) => {
          mockSWRCacheSlowOp(params);
        },
      },
    },
  },
}));

function buildMutationAcknowledgement(request: {
  key?: string;
  operation?: string;
  patch?: {
    removals: Array<readonly [string, number]>;
    updates: Array<readonly [string, string]>;
  };
  scope: string;
  sourceMutationId?: number;
  store?: string;
  value?: string;
}) {
  if (request.scope !== 'syncStorage' || !request.store) {
    return undefined;
  }
  if (request.operation === 'set' && request.key !== undefined) {
    return {
      store: request.store,
      operation: 'set',
      key: request.key,
      value: request.value,
      sourceMutationId: request.sourceMutationId,
    };
  }
  if (request.operation === 'remove' && request.key !== undefined) {
    return {
      store: request.store,
      operation: 'remove',
      key: request.key,
      sourceMutationId: request.sourceMutationId,
    };
  }
  if (request.operation === 'patchSWR' && request.patch) {
    return {
      store: request.store,
      operation: 'patchSWR',
      entries: [
        ...request.patch.removals.map(([key]) => [key, null] as const),
        ...request.patch.updates,
      ],
      sourceMutationId: request.sourceMutationId,
    };
  }
  return {
    store: request.store,
    operation: 'clear',
    sourceMutationId: request.sourceMutationId,
  };
}

jest.mock('../nativeStorageBridge', () => ({
  callNativeStorage: (request: unknown): Promise<unknown> =>
    mockCallNativeStorage(request) as Promise<unknown>,
}));

function loadMirror() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./nativeSyncStorageMirror') as typeof import('./nativeSyncStorageMirror');
}

describe('nativeSyncStorageMirror', () => {
  beforeEach(() => {
    jest.resetModules();
    mockCallNativeStorage.mockReset();
    mockNativeStorageQueueState.mockReset();
    mockSWRCacheSlowOp.mockReset();
    delete (
      globalThis as typeof globalThis & {
        __onekeyNativeStorageIsTransportReady?: () => boolean;
      }
    ).__onekeyNativeStorageIsTransportReady;
    delete (
      globalThis as typeof globalThis & {
        __onekeyNativeSyncStorageTransportReady?: () => void;
      }
    ).__onekeyNativeSyncStorageTransportReady;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('primes synchronous UI reads from a bg-owned bootstrap snapshot', async () => {
    mockCallNativeStorage.mockResolvedValueOnce({
      settings: [['setting', true]],
      coldStart: [['cache', 'value']],
      devSettings: [['dev', false]],
    });
    const { bootstrapNativeSyncStorageMirrors, createNativeSyncStorageMirror } =
      loadMirror();
    const settings = createNativeSyncStorageMirror('settings');
    const coldStart = createNativeSyncStorageMirror('coldStart');

    await bootstrapNativeSyncStorageMirrors();

    expect(settings.getBoolean('setting')).toBe(true);
    expect(coldStart.getString('cache')).toBe('value');
    expect(mockCallNativeStorage).toHaveBeenCalledWith({ scope: 'bootstrap' });
  });

  it('updates UI memory immediately and serializes mutations to bg', async () => {
    mockCallNativeStorage.mockImplementation(async (request) =>
      buildMutationAcknowledgement(request),
    );
    const { createNativeSyncStorageMirror, waitForNativeSyncStorageMutations } =
      loadMirror();
    const storage = createNativeSyncStorageMirror('coldStart');

    void storage.set('key', 'first');
    void storage.set('key', 'second');
    void storage.set('key', 'third');
    expect(storage.getString('key')).toBe('third');
    await waitForNativeSyncStorageMutations();

    expect(mockCallNativeStorage.mock.calls).toEqual([
      [
        {
          scope: 'syncStorage',
          operation: 'set',
          store: 'coldStart',
          key: 'key',
          sourceMutationId: 1,
          sourceRuntimeId: expect.any(String),
          value: 'first',
        },
      ],
      [
        {
          scope: 'syncStorage',
          operation: 'set',
          store: 'coldStart',
          key: 'key',
          value: 'third',
          previousValue: 'first',
          sourceMutationId: 3,
          sourceRuntimeId: expect.any(String),
        },
      ],
    ]);
  });

  it('replays local pre-bootstrap mutations over the returned snapshot', async () => {
    mockCallNativeStorage.mockImplementation(
      async (request: { scope: string }) =>
        request.scope === 'bootstrap'
          ? {
              settings: [['key', 'stale-bg']],
              coldStart: [],
              devSettings: [],
            }
          : buildMutationAcknowledgement(request),
    );
    const { bootstrapNativeSyncStorageMirrors, createNativeSyncStorageMirror } =
      loadMirror();
    const storage = createNativeSyncStorageMirror('settings');
    void storage.set('key', 'local');

    await bootstrapNativeSyncStorageMirrors();

    expect(storage.getString('key')).toBe('local');
  });

  it('drains each store independently while preserving FIFO within a store', async () => {
    let resolveSettings: ((acknowledgement: unknown) => void) | undefined;
    let settingsRequest:
      | Parameters<typeof buildMutationAcknowledgement>[0]
      | undefined;
    mockCallNativeStorage.mockImplementation(
      (request: Parameters<typeof buildMutationAcknowledgement>[0]) => {
        if (request.store === 'settings') {
          settingsRequest = request;
          return new Promise<unknown>((resolve) => {
            resolveSettings = resolve;
          });
        }
        return Promise.resolve(buildMutationAcknowledgement(request));
      },
    );
    const { createNativeSyncStorageMirror, waitForNativeSyncStorageMutations } =
      loadMirror();
    const settings = createNativeSyncStorageMirror('settings');
    const coldStart = createNativeSyncStorageMirror('coldStart');

    void settings.set('settings-key', 'settings-value');
    void coldStart.set('cache-key', 'cache-value');
    await Promise.resolve();
    await Promise.resolve();

    expect(mockCallNativeStorage).toHaveBeenCalledTimes(2);
    expect(mockCallNativeStorage.mock.calls[1][0]).toEqual(
      expect.objectContaining({ store: 'coldStart' }),
    );
    expect(settingsRequest).toBeDefined();
    expect(resolveSettings).toBeDefined();
    resolveSettings?.(
      buildMutationAcknowledgement(
        settingsRequest as Parameters<typeof buildMutationAcknowledgement>[0],
      ),
    );
    await waitForNativeSyncStorageMutations();
  });

  it('uses exponential retry delays without emitting per-retry diagnostics', async () => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    mockCallNativeStorage
      .mockRejectedValueOnce(new Error('first failure'))
      .mockRejectedValueOnce(new Error('second failure'))
      .mockImplementation(async (request) =>
        buildMutationAcknowledgement(request),
      );
    const { createNativeSyncStorageMirror, waitForNativeSyncStorageMutations } =
      loadMirror();
    const storage = createNativeSyncStorageMirror('settings');

    void storage.set('sensitive-key', 'sensitive-value');
    await waitForNativeSyncStorageMutations();
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(499);
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    await waitForNativeSyncStorageMutations();
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(999);
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    await waitForNativeSyncStorageMutations();
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(3);

    expect(mockNativeStorageQueueState.mock.calls).toHaveLength(2);
    expect(mockNativeStorageQueueState.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        eventType: 'degraded',
        failedAttemptCount: 1,
        store: 'settings',
      }),
    );
    expect(mockNativeStorageQueueState.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        eventType: 'recovered',
        failedAttemptCount: 2,
        store: 'settings',
      }),
    );
    const diagnosticPayload = JSON.stringify(
      mockNativeStorageQueueState.mock.calls,
    );
    expect(diagnosticPayload).not.toContain('sensitive-key');
    expect(diagnosticPayload).not.toContain('sensitive-value');
  });

  it('suppresses rapidly repeated failure episodes during the cooldown', async () => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    mockCallNativeStorage
      .mockRejectedValueOnce(new Error('first episode'))
      .mockImplementationOnce(async (request) =>
        buildMutationAcknowledgement(request),
      )
      .mockRejectedValueOnce(new Error('second episode'))
      .mockImplementationOnce(async (request) =>
        buildMutationAcknowledgement(request),
      );
    const { createNativeSyncStorageMirror, waitForNativeSyncStorageMutations } =
      loadMirror();
    const storage = createNativeSyncStorageMirror('coldStart');

    void storage.set('key', 'first');
    await waitForNativeSyncStorageMutations();
    await jest.advanceTimersByTimeAsync(500);
    await waitForNativeSyncStorageMutations();

    void storage.set('key', 'second');
    await waitForNativeSyncStorageMutations();
    await jest.advanceTimersByTimeAsync(500);
    await waitForNativeSyncStorageMutations();

    expect(mockNativeStorageQueueState.mock.calls).toEqual([
      [expect.objectContaining({ eventType: 'degraded' })],
      [expect.objectContaining({ eventType: 'recovered' })],
    ]);
  });

  it('pauses while bg is unavailable and resumes immediately on ready', async () => {
    jest.useFakeTimers();
    let isReady = false;
    const nativeStorageGlobal = globalThis as typeof globalThis & {
      __onekeyNativeStorageIsTransportReady?: () => boolean;
      __onekeyNativeSyncStorageTransportReady?: () => void;
    };
    nativeStorageGlobal.__onekeyNativeStorageIsTransportReady = () => isReady;
    mockCallNativeStorage.mockImplementation(async (request) =>
      buildMutationAcknowledgement(request),
    );
    const { createNativeSyncStorageMirror, waitForNativeSyncStorageMutations } =
      loadMirror();
    const storage = createNativeSyncStorageMirror('devSettings');

    void storage.set('dev-key', true);
    await waitForNativeSyncStorageMutations();
    expect(mockCallNativeStorage).not.toHaveBeenCalled();

    isReady = true;
    nativeStorageGlobal.__onekeyNativeSyncStorageTransportReady?.();
    await waitForNativeSyncStorageMutations();

    expect(mockCallNativeStorage).toHaveBeenCalledTimes(1);
    expect(mockNativeStorageQueueState).not.toHaveBeenCalled();

    isReady = false;
    void storage.set('another-dev-key', false);
    await waitForNativeSyncStorageMutations();
    isReady = true;
    nativeStorageGlobal.__onekeyNativeSyncStorageTransportReady?.();
    await waitForNativeSyncStorageMutations();

    // Transport lifecycle logging is global, so paused queues stay silent.
    expect(mockNativeStorageQueueState).not.toHaveBeenCalled();
  });

  it('compacts same-key writes while bg is unavailable', async () => {
    let isReady = false;
    const nativeStorageGlobal = globalThis as typeof globalThis & {
      __onekeyNativeStorageIsTransportReady?: () => boolean;
      __onekeyNativeSyncStorageTransportReady?: () => void;
    };
    nativeStorageGlobal.__onekeyNativeStorageIsTransportReady = () => isReady;
    mockCallNativeStorage.mockImplementation(async (request) =>
      buildMutationAcknowledgement(request),
    );
    const { createNativeSyncStorageMirror, waitForNativeSyncStorageMutations } =
      loadMirror();
    const storage = createNativeSyncStorageMirror('coldStart');

    void storage.set('key', 'first');
    void storage.set('key', 'second');
    void storage.set('key', 'third');
    expect(storage.getString('key')).toBe('third');
    expect(mockCallNativeStorage).not.toHaveBeenCalled();

    isReady = true;
    nativeStorageGlobal.__onekeyNativeSyncStorageTransportReady?.();
    await waitForNativeSyncStorageMutations();

    expect(mockCallNativeStorage.mock.calls).toEqual([
      [
        {
          scope: 'syncStorage',
          operation: 'set',
          store: 'coldStart',
          key: 'key',
          value: 'third',
          sourceMutationId: 3,
          sourceRuntimeId: expect.any(String),
        },
      ],
    ]);
  });

  it('resolves every compacted write only after the final bg acknowledgement', async () => {
    let isReady = false;
    const nativeStorageGlobal = globalThis as typeof globalThis & {
      __onekeyNativeStorageIsTransportReady?: () => boolean;
      __onekeyNativeSyncStorageTransportReady?: () => void;
    };
    nativeStorageGlobal.__onekeyNativeStorageIsTransportReady = () => isReady;
    mockCallNativeStorage.mockImplementation(async (request) =>
      buildMutationAcknowledgement(request),
    );
    const { createNativeSyncStorageMirror } = loadMirror();
    const storage = createNativeSyncStorageMirror('settings');

    const firstAcknowledgement = storage.set('key', 'first');
    const finalAcknowledgement = storage.set('key', 'final');
    let firstSettled = false;
    void firstAcknowledgement.then(() => {
      firstSettled = true;
    });
    await Promise.resolve();
    expect(firstSettled).toBe(false);

    isReady = true;
    nativeStorageGlobal.__onekeyNativeSyncStorageTransportReady?.();
    await Promise.all([firstAcknowledgement, finalAcknowledgement]);

    expect(firstSettled).toBe(true);
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(1);
    expect(mockCallNativeStorage.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        key: 'key',
        value: 'final',
        sourceMutationId: 2,
      }),
    );
  });

  it('drops unsent mutations that are superseded by a clear', async () => {
    let isReady = false;
    const nativeStorageGlobal = globalThis as typeof globalThis & {
      __onekeyNativeStorageIsTransportReady?: () => boolean;
      __onekeyNativeSyncStorageTransportReady?: () => void;
    };
    nativeStorageGlobal.__onekeyNativeStorageIsTransportReady = () => isReady;
    mockCallNativeStorage.mockImplementation(async (request) =>
      buildMutationAcknowledgement(request),
    );
    const { createNativeSyncStorageMirror, waitForNativeSyncStorageMutations } =
      loadMirror();
    const storage = createNativeSyncStorageMirror('settings');

    void storage.set('a', 'first');
    void storage.set('b', 'second');
    void storage.clearAll();
    void storage.set('c', 'kept');

    isReady = true;
    nativeStorageGlobal.__onekeyNativeSyncStorageTransportReady?.();
    await waitForNativeSyncStorageMutations();

    expect(mockCallNativeStorage.mock.calls).toEqual([
      [
        {
          scope: 'syncStorage',
          operation: 'clear',
          store: 'settings',
          sourceMutationId: 3,
          sourceRuntimeId: expect.any(String),
        },
      ],
      [
        {
          scope: 'syncStorage',
          operation: 'set',
          store: 'settings',
          key: 'c',
          value: 'kept',
          sourceMutationId: 4,
          sourceRuntimeId: expect.any(String),
        },
      ],
    ]);
  });

  it('preserves the committed SWR baseline when pending writes compact', async () => {
    let isReady = true;
    const nativeStorageGlobal = globalThis as typeof globalThis & {
      __onekeyNativeStorageIsTransportReady?: () => boolean;
      __onekeyNativeSyncStorageTransportReady?: () => void;
    };
    nativeStorageGlobal.__onekeyNativeStorageIsTransportReady = () => isReady;
    const initialValue = JSON.stringify({ initial: { d: 'bg', t: 1 } });
    const firstValue = JSON.stringify({ first: { d: 'main', t: 2 } });
    const finalValue = JSON.stringify({ final: { d: 'main', t: 3 } });
    mockCallNativeStorage.mockImplementation(
      async (request: Parameters<typeof buildMutationAcknowledgement>[0]) =>
        request.scope === 'bootstrap'
          ? {
              settings: [],
              coldStart: [['onekey_swr_cache', initialValue]],
              devSettings: [],
            }
          : buildMutationAcknowledgement(request),
    );
    const {
      bootstrapNativeSyncStorageMirrors,
      createNativeSyncStorageMirror,
      waitForNativeSyncStorageMutations,
    } = loadMirror();
    const storage = createNativeSyncStorageMirror('coldStart');
    await bootstrapNativeSyncStorageMirrors();

    isReady = false;
    void storage.set('onekey_swr_cache', firstValue);
    void storage.set('onekey_swr_cache', finalValue);
    isReady = true;
    nativeStorageGlobal.__onekeyNativeSyncStorageTransportReady?.();
    await waitForNativeSyncStorageMutations();

    expect(mockCallNativeStorage.mock.calls[1][0]).toEqual({
      scope: 'syncStorage',
      operation: 'set',
      store: 'coldStart',
      key: 'onekey_swr_cache',
      value: finalValue,
      previousValue: initialValue,
      sourceMutationId: 2,
      sourceRuntimeId: expect.any(String),
    });
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(2);
  });

  it('sends only changed SWR entries to bg instead of the full cache blob', async () => {
    const initialValue = JSON.stringify({
      existing: { d: 'large-existing-value', t: 1 },
    });
    mockCallNativeStorage.mockImplementation(
      async (request: Parameters<typeof buildMutationAcknowledgement>[0]) =>
        request.scope === 'bootstrap'
          ? {
              settings: [],
              coldStart: [['onekey_swr_cache', initialValue]],
              devSettings: [],
            }
          : buildMutationAcknowledgement(request),
    );
    const {
      bootstrapNativeSyncStorageMirrors,
      createNativeSyncStorageMirror,
      waitForNativeSyncStorageMutations,
    } = loadMirror();
    const storage = createNativeSyncStorageMirror('coldStart');
    await bootstrapNativeSyncStorageMirrors();

    void storage.applySWRCachePatch?.({
      removePrefixes: [],
      removals: [],
      updates: [['changed', JSON.stringify({ d: 'small', t: 2 })]],
    });
    await waitForNativeSyncStorageMutations();

    expect(mockCallNativeStorage.mock.calls[1][0]).toEqual({
      scope: 'syncStorage',
      operation: 'patchSWR',
      store: 'coldStart',
      patch: {
        removePrefixes: [],
        removals: [],
        updates: [['changed', JSON.stringify({ d: 'small', t: 2 })]],
      },
      sourceMutationId: 1,
      sourceRuntimeId: expect.any(String),
    });
    expect(JSON.parse(storage.getString('onekey_swr_cache') ?? '{}')).toEqual({
      existing: { d: 'large-existing-value', t: 1 },
      changed: { d: 'small', t: 2 },
    });
  });

  it('does not resurrect an entry when a patch tombstone is newer than its update', async () => {
    mockCallNativeStorage.mockImplementation(
      async (request: Parameters<typeof buildMutationAcknowledgement>[0]) => {
        if (request.scope === 'bootstrap') {
          return { settings: [], coldStart: [], devSettings: [] };
        }
        if (request.operation === 'patchSWR' && request.patch) {
          return {
            store: request.store,
            operation: 'patchSWR',
            entries: request.patch.removals.map(([key]) => [key, null]),
            sourceMutationId: request.sourceMutationId,
          };
        }
        return buildMutationAcknowledgement(request);
      },
    );
    const {
      bootstrapNativeSyncStorageMirrors,
      createNativeSyncStorageMirror,
      waitForNativeSyncStorageMutations,
    } = loadMirror();
    const storage = createNativeSyncStorageMirror('coldStart');
    await bootstrapNativeSyncStorageMirrors();

    void storage.applySWRCachePatch?.({
      removePrefixes: [],
      removals: [['deleted', 10]],
      updates: [['deleted', JSON.stringify({ d: 'stale', t: 5 })]],
    });
    await waitForNativeSyncStorageMutations();

    expect(storage.readSWRCacheEntries?.()).toEqual([]);
    expect(mockCallNativeStorage.mock.calls[1][0]).toMatchObject({
      operation: 'patchSWR',
      patch: {
        removals: [['deleted', 10]],
        updates: [['deleted', JSON.stringify({ d: 'stale', t: 5 })]],
      },
    });
  });

  it('bounds an offline SWR patch queue by merging it into one patch', async () => {
    let isReady = true;
    const nativeStorageGlobal = globalThis as typeof globalThis & {
      __onekeyNativeStorageIsTransportReady?: () => boolean;
      __onekeyNativeSyncStorageTransportReady?: () => void;
    };
    nativeStorageGlobal.__onekeyNativeStorageIsTransportReady = () => isReady;
    const initialValue = JSON.stringify({ initial: { d: 'bg', t: 1 } });
    mockCallNativeStorage.mockImplementation(
      async (request: Parameters<typeof buildMutationAcknowledgement>[0]) =>
        request.scope === 'bootstrap'
          ? {
              settings: [],
              coldStart: [['onekey_swr_cache', initialValue]],
              devSettings: [],
            }
          : buildMutationAcknowledgement(request),
    );
    const {
      bootstrapNativeSyncStorageMirrors,
      createNativeSyncStorageMirror,
      waitForNativeSyncStorageMutations,
    } = loadMirror();
    const storage = createNativeSyncStorageMirror('coldStart');
    await bootstrapNativeSyncStorageMirrors();

    isReady = false;
    for (let index = 0; index < 101; index += 1) {
      void storage.applySWRCachePatch?.({
        removePrefixes: [],
        removals: [],
        updates: [
          [
            `changed-${index}`,
            JSON.stringify({ d: `value-${index}`, t: index + 2 }),
          ],
        ],
      });
    }
    isReady = true;
    nativeStorageGlobal.__onekeyNativeSyncStorageTransportReady?.();
    await waitForNativeSyncStorageMutations();

    expect(mockCallNativeStorage).toHaveBeenCalledTimes(2);
    const request = mockCallNativeStorage.mock.calls[1][0] as {
      operation: string;
      patch: { removals: unknown[]; updates: Array<[string, string]> };
    };
    expect(request).toMatchObject({
      scope: 'syncStorage',
      operation: 'patchSWR',
      store: 'coldStart',
    });
    expect(request.patch.removals).toEqual([]);
    expect(request.patch.updates.map(([key]) => key)).toEqual(
      Array.from({ length: 101 }, (_, index) => `changed-${index}`),
    );
    expect(
      Object.keys(
        JSON.parse(storage.getString('onekey_swr_cache') ?? '{}') as Record<
          string,
          unknown
        >,
      ),
    ).toHaveLength(102);
  });

  it('drops the pending updates a later tombstone deletes when patches merge', async () => {
    let isReady = true;
    const nativeStorageGlobal = globalThis as typeof globalThis & {
      __onekeyNativeStorageIsTransportReady?: () => boolean;
      __onekeyNativeSyncStorageTransportReady?: () => void;
    };
    nativeStorageGlobal.__onekeyNativeStorageIsTransportReady = () => isReady;
    mockCallNativeStorage.mockImplementation(
      async (request: Parameters<typeof buildMutationAcknowledgement>[0]) =>
        request.scope === 'bootstrap'
          ? { settings: [], coldStart: [], devSettings: [] }
          : buildMutationAcknowledgement(request),
    );
    const {
      bootstrapNativeSyncStorageMirrors,
      createNativeSyncStorageMirror,
      waitForNativeSyncStorageMutations,
    } = loadMirror();
    const storage = createNativeSyncStorageMirror('coldStart');
    await bootstrapNativeSyncStorageMirrors();

    isReady = false;
    const emptyPatch = { removePrefixes: [], removals: [] };
    void storage.applySWRCachePatch?.({
      ...emptyPatch,
      updates: [
        ['gone', JSON.stringify({ d: 'stale', t: 2 })],
        ['kept', JSON.stringify({ d: 'kept', t: 2 })],
      ],
    });
    for (let index = 0; index < 100; index += 1) {
      void storage.applySWRCachePatch?.({
        ...emptyPatch,
        updates: [[`other-${index}`, JSON.stringify({ d: index, t: 3 })]],
      });
    }
    void storage.applySWRCachePatch?.({
      removePrefixes: [],
      removals: [['gone', 4]],
      updates: [['kept', JSON.stringify({ d: 'newer', t: 5 })]],
    });
    isReady = true;
    nativeStorageGlobal.__onekeyNativeSyncStorageTransportReady?.();
    await waitForNativeSyncStorageMutations();

    expect(mockCallNativeStorage).toHaveBeenCalledTimes(2);
    const request = mockCallNativeStorage.mock.calls[1][0] as {
      patch: {
        removals: Array<[string, number]>;
        updates: Array<[string, string]>;
      };
    };
    expect(request.patch.removals).toEqual([['gone', 4]]);
    expect(new Map(request.patch.updates).has('gone')).toBe(false);
    expect(new Map(request.patch.updates).get('kept')).toBe(
      JSON.stringify({ d: 'newer', t: 5 }),
    );
    expect(request.patch.updates).toHaveLength(101);
    expect(JSON.parse(storage.getString('onekey_swr_cache') ?? '{}')).toEqual(
      expect.objectContaining({ kept: { d: 'newer', t: 5 } }),
    );
    expect(storage.getString('onekey_swr_cache')).not.toContain('"gone"');
  });

  it('keeps the newer entry when a merged patch carries an older one', async () => {
    let isReady = true;
    const nativeStorageGlobal = globalThis as typeof globalThis & {
      __onekeyNativeStorageIsTransportReady?: () => boolean;
      __onekeyNativeSyncStorageTransportReady?: () => void;
    };
    nativeStorageGlobal.__onekeyNativeStorageIsTransportReady = () => isReady;
    mockCallNativeStorage.mockImplementation(
      async (request: Parameters<typeof buildMutationAcknowledgement>[0]) =>
        request.scope === 'bootstrap'
          ? { settings: [], coldStart: [], devSettings: [] }
          : buildMutationAcknowledgement(request),
    );
    const {
      bootstrapNativeSyncStorageMirrors,
      createNativeSyncStorageMirror,
      waitForNativeSyncStorageMutations,
    } = loadMirror();
    const storage = createNativeSyncStorageMirror('coldStart');
    await bootstrapNativeSyncStorageMirrors();

    isReady = false;
    const newer = JSON.stringify({ d: 'newer', t: 10 });
    void storage.applySWRCachePatch?.({
      removePrefixes: [],
      removals: [],
      updates: [['clock', newer]],
    });
    // A backwards clock correction makes a later write carry an older stamp.
    for (let index = 0; index < 100; index += 1) {
      void storage.applySWRCachePatch?.({
        removePrefixes: [],
        removals: [],
        updates: [
          [
            index === 99 ? 'clock' : `other-${index}`,
            JSON.stringify({ d: 'older', t: 5 }),
          ],
        ],
      });
    }
    isReady = true;
    nativeStorageGlobal.__onekeyNativeSyncStorageTransportReady?.();
    await waitForNativeSyncStorageMutations();

    const request = mockCallNativeStorage.mock.calls[1][0] as {
      patch: { updates: Array<[string, string]> };
    };
    expect(new Map(request.patch.updates).get('clock')).toBe(newer);
    expect(new Map(storage.readSWRCacheEntries?.()).get('clock')).toBe(newer);
  });

  it('reports bg-originated entry changes and stays silent for acknowledged local writes', async () => {
    mockCallNativeStorage.mockImplementation(
      async (request: Parameters<typeof buildMutationAcknowledgement>[0]) =>
        request.scope === 'bootstrap'
          ? {
              settings: [],
              coldStart: [],
              devSettings: [],
              swrCacheEntries: [['seeded', JSON.stringify({ d: 'bg', t: 1 })]],
            }
          : buildMutationAcknowledgement(request),
    );
    const {
      bootstrapNativeSyncStorageMirrors,
      createNativeSyncStorageMirror,
      waitForNativeSyncStorageMutations,
    } = loadMirror();
    const storage = createNativeSyncStorageMirror('coldStart');
    const listener = jest.fn();
    storage.subscribeSWRCacheEntries?.(listener);
    await bootstrapNativeSyncStorageMirrors();

    expect(listener).toHaveBeenCalledWith(null);
    expect(storage.readSWRCacheEntries?.()).toEqual([
      ['seeded', JSON.stringify({ d: 'bg', t: 1 })],
    ]);
    listener.mockClear();

    void storage.applySWRCachePatch?.({
      removePrefixes: [],
      removals: [],
      updates: [['mine', JSON.stringify({ d: 'a', t: 2 })]],
    });
    await waitForNativeSyncStorageMutations();
    expect(listener).not.toHaveBeenCalled();

    const applyBroadcast = (
      globalThis as typeof globalThis & {
        __onekeyNativeSyncStorageApplyMutation?: (mutation: {
          store: 'coldStart';
          operation: 'patchSWR';
          entries: Array<readonly [string, string | null]>;
        }) => void;
      }
    ).__onekeyNativeSyncStorageApplyMutation;
    applyBroadcast?.({
      store: 'coldStart',
      operation: 'patchSWR',
      entries: [
        ['theirs', JSON.stringify({ d: 'b', t: 3 })],
        ['seeded', null],
        ['mine', JSON.stringify({ d: 'a', t: 2 })],
      ],
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith([
      ['theirs', JSON.stringify({ d: 'b', t: 3 })],
      ['seeded', null],
    ]);
    expect(storage.readSWRCacheEntries?.()).toEqual([
      ['mine', JSON.stringify({ d: 'a', t: 2 })],
      ['theirs', JSON.stringify({ d: 'b', t: 3 })],
    ]);
    expect(storage.getString('onekey_swr_cache')).toBe(
      JSON.stringify({ mine: { d: 'a', t: 2 }, theirs: { d: 'b', t: 3 } }),
    );
  });

  it('keeps an unacknowledged local entry over an older bg broadcast', async () => {
    let isReady = true;
    const nativeStorageGlobal = globalThis as typeof globalThis & {
      __onekeyNativeStorageIsTransportReady?: () => boolean;
      __onekeyNativeSyncStorageApplyMutation?: (mutation: {
        store: 'coldStart';
        operation: 'patchSWR';
        entries: Array<readonly [string, string | null]>;
      }) => void;
    };
    nativeStorageGlobal.__onekeyNativeStorageIsTransportReady = () => isReady;
    mockCallNativeStorage.mockImplementation(
      async (request: Parameters<typeof buildMutationAcknowledgement>[0]) =>
        request.scope === 'bootstrap'
          ? { settings: [], coldStart: [], devSettings: [] }
          : buildMutationAcknowledgement(request),
    );
    const { bootstrapNativeSyncStorageMirrors, createNativeSyncStorageMirror } =
      loadMirror();
    const storage = createNativeSyncStorageMirror('coldStart');
    const listener = jest.fn();
    await bootstrapNativeSyncStorageMirrors();
    storage.subscribeSWRCacheEntries?.(listener);

    isReady = false;
    void storage.applySWRCachePatch?.({
      removePrefixes: [],
      removals: [],
      updates: [['mine', JSON.stringify({ d: 'local', t: 5 })]],
    });
    nativeStorageGlobal.__onekeyNativeSyncStorageApplyMutation?.({
      store: 'coldStart',
      operation: 'patchSWR',
      entries: [['mine', JSON.stringify({ d: 'stale-bg', t: 4 })]],
    });

    expect(listener).not.toHaveBeenCalled();
    expect(new Map(storage.readSWRCacheEntries?.()).get('mine')).toBe(
      JSON.stringify({ d: 'local', t: 5 }),
    );
  });

  it('applies bg broadcasts and replays them over an in-flight snapshot', async () => {
    let resolveBootstrap:
      | ((snapshot: {
          settings: [string, string][];
          coldStart: never[];
          devSettings: never[];
        }) => void)
      | undefined;
    mockCallNativeStorage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBootstrap = resolve;
        }),
    );
    const { bootstrapNativeSyncStorageMirrors, createNativeSyncStorageMirror } =
      loadMirror();
    const storage = createNativeSyncStorageMirror('settings');
    const bootstrap = bootstrapNativeSyncStorageMirrors();

    (
      globalThis as typeof globalThis & {
        __onekeyNativeSyncStorageApplyMutation?: (mutation: {
          store: 'settings';
          operation: 'set';
          key: string;
          value: string;
        }) => void;
      }
    ).__onekeyNativeSyncStorageApplyMutation?.({
      store: 'settings',
      operation: 'set',
      key: 'key',
      value: 'fresh-bg',
    });
    resolveBootstrap?.({
      settings: [['key', 'stale-snapshot']],
      coldStart: [],
      devSettings: [],
    });
    await bootstrap;

    expect(storage.getString('key')).toBe('fresh-bg');
  });

  it('reports a slow SWR apply with its source, and stays silent when fast', async () => {
    mockCallNativeStorage.mockImplementation(
      async (request: Parameters<typeof buildMutationAcknowledgement>[0]) =>
        request.scope === 'bootstrap'
          ? { settings: [], coldStart: [], devSettings: [] }
          : buildMutationAcknowledgement(request),
    );
    const {
      bootstrapNativeSyncStorageMirrors,
      createNativeSyncStorageMirror,
      waitForNativeSyncStorageMutations,
    } = loadMirror();
    const storage = createNativeSyncStorageMirror('coldStart');
    await bootstrapNativeSyncStorageMirrors();
    const perfSpy = jest.spyOn(globalThis.performance, 'now');
    const applyBroadcast = (
      globalThis as typeof globalThis & {
        __onekeyNativeSyncStorageApplyMutation?: (mutation: {
          store: 'coldStart';
          operation: 'patchSWR';
          entries: Array<readonly [string, string | null]>;
        }) => void;
      }
    ).__onekeyNativeSyncStorageApplyMutation;

    // An acknowledgement applied within the budget leaves no trace.
    perfSpy.mockReturnValue(0);
    void storage.applySWRCachePatch?.({
      removePrefixes: [],
      removals: [],
      updates: [['mine', JSON.stringify({ d: 'a', t: 1 })]],
    });
    await waitForNativeSyncStorageMutations();
    expect(mockSWRCacheSlowOp).not.toHaveBeenCalled();

    perfSpy.mockReturnValueOnce(0).mockReturnValueOnce(80);
    applyBroadcast?.({
      store: 'coldStart',
      operation: 'patchSWR',
      entries: [['theirs', JSON.stringify({ d: 'b', t: 2 })]],
    });

    expect(mockSWRCacheSlowOp).toHaveBeenCalledTimes(1);
    expect(mockSWRCacheSlowOp).toHaveBeenCalledWith({
      op: 'mirrorApply',
      durationMs: 80,
      storeChars: storage.getString('onekey_swr_cache')?.length,
      source: 'broadcast',
      mutationOp: 'patchSWR',
      replayedCount: 0,
    });
  });

  it('refreshes all mirrors after the bg runtime restarts', async () => {
    mockCallNativeStorage
      .mockResolvedValueOnce({
        settings: [['key', 'first-bg']],
        coldStart: [],
        devSettings: [],
      })
      .mockResolvedValueOnce({
        settings: [['key', 'restarted-bg']],
        coldStart: [],
        devSettings: [],
      });
    const {
      bootstrapNativeSyncStorageMirrors,
      createNativeSyncStorageMirror,
      refreshNativeSyncStorageMirrors,
    } = loadMirror();
    const storage = createNativeSyncStorageMirror('settings');

    await bootstrapNativeSyncStorageMirrors();
    await refreshNativeSyncStorageMirrors();

    expect(storage.getString('key')).toBe('restarted-bg');
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(2);
  });

  it('discards a stale bootstrap snapshot after a forced retry', async () => {
    let resolveFirst:
      | ((snapshot: {
          settings: [string, string][];
          coldStart: never[];
          devSettings: never[];
        }) => void)
      | undefined;
    let resolveSecond: typeof resolveFirst;
    mockCallNativeStorage
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );
    const {
      bootstrapNativeSyncStorageMirrors,
      createNativeSyncStorageMirror,
      refreshNativeSyncStorageMirrors,
    } = loadMirror();
    const storage = createNativeSyncStorageMirror('settings');

    const first = bootstrapNativeSyncStorageMirrors();
    const retry = refreshNativeSyncStorageMirrors();
    resolveFirst?.({
      settings: [['key', 'stale']],
      coldStart: [],
      devSettings: [],
    });
    await Promise.resolve();
    expect(storage.getString('key')).toBeUndefined();

    resolveSecond?.({
      settings: [['key', 'fresh']],
      coldStart: [],
      devSettings: [],
    });
    await Promise.all([first, retry]);

    expect(storage.getString('key')).toBe('fresh');
  });

  it('replays failed synchronous mutations in FIFO order after bg restart', async () => {
    mockCallNativeStorage
      .mockResolvedValueOnce({
        settings: [['key', 'initial-bg']],
        coldStart: [],
        devSettings: [],
      })
      .mockRejectedValueOnce(new Error('background restarted'))
      .mockResolvedValueOnce({
        settings: [['key', 'stale-after-restart']],
        coldStart: [],
        devSettings: [],
      })
      .mockResolvedValueOnce({
        store: 'settings',
        operation: 'set',
        key: 'key',
        value: 'local-unacknowledged',
        sourceMutationId: 1,
      })
      .mockResolvedValueOnce({
        store: 'settings',
        operation: 'set',
        key: 'key',
        value: 'newer-local-value',
        sourceMutationId: 2,
      });
    const {
      bootstrapNativeSyncStorageMirrors,
      createNativeSyncStorageMirror,
      refreshNativeSyncStorageMirrors,
      waitForNativeSyncStorageMutations,
    } = loadMirror();
    const storage = createNativeSyncStorageMirror('settings');

    await bootstrapNativeSyncStorageMirrors();
    void storage.set('key', 'local-unacknowledged');
    void storage.set('key', 'newer-local-value');
    await waitForNativeSyncStorageMutations();

    // A later write must stay queued behind the failed head instead of being
    // acknowledged first and allowing the older value to overwrite the UI.
    expect(storage.getString('key')).toBe('newer-local-value');
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(2);

    await refreshNativeSyncStorageMirrors();
    await waitForNativeSyncStorageMutations();

    expect(storage.getString('key')).toBe('newer-local-value');
    expect(mockCallNativeStorage.mock.calls).toEqual([
      [{ scope: 'bootstrap' }],
      [
        {
          scope: 'syncStorage',
          operation: 'set',
          store: 'settings',
          key: 'key',
          sourceMutationId: 1,
          sourceRuntimeId: expect.any(String),
          value: 'local-unacknowledged',
          previousValue: 'initial-bg',
        },
      ],
      [{ scope: 'bootstrap' }],
      [
        {
          scope: 'syncStorage',
          operation: 'set',
          store: 'settings',
          key: 'key',
          sourceMutationId: 1,
          sourceRuntimeId: expect.any(String),
          value: 'local-unacknowledged',
          previousValue: 'initial-bg',
        },
      ],
      [
        {
          scope: 'syncStorage',
          operation: 'set',
          store: 'settings',
          key: 'key',
          sourceMutationId: 2,
          sourceRuntimeId: expect.any(String),
          value: 'newer-local-value',
          previousValue: 'local-unacknowledged',
        },
      ],
    ]);
    expect(mockNativeStorageQueueState.mock.calls).toEqual([
      [expect.objectContaining({ eventType: 'degraded', store: 'settings' })],
      [expect.objectContaining({ eventType: 'recovered', store: 'settings' })],
    ]);
  });
});
