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
      devSettings: [['dev', false]],
    });
    const { bootstrapNativeSyncStorageMirrors, createNativeSyncStorageMirror } =
      loadMirror();
    const settings = createNativeSyncStorageMirror('settings');
    const devSettings = createNativeSyncStorageMirror('devSettings');

    await bootstrapNativeSyncStorageMirrors();

    expect(settings.getBoolean('setting')).toBe(true);
    expect(devSettings.getBoolean('dev')).toBe(false);
    expect(mockCallNativeStorage).toHaveBeenCalledWith({
      scope: 'bootstrap',
      stores: ['settings', 'devSettings'],
    });
  });

  it('updates UI memory immediately and serializes mutations to bg', async () => {
    mockCallNativeStorage.mockImplementation(async (request) =>
      buildMutationAcknowledgement(request),
    );
    const { createNativeSyncStorageMirror, waitForNativeSyncStorageMutations } =
      loadMirror();
    const storage = createNativeSyncStorageMirror('devSettings');

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
          store: 'devSettings',
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
          store: 'devSettings',
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
    const devSettings = createNativeSyncStorageMirror('devSettings');

    void settings.set('settings-key', 'settings-value');
    void devSettings.set('cache-key', 'cache-value');
    await Promise.resolve();
    await Promise.resolve();

    expect(mockCallNativeStorage).toHaveBeenCalledTimes(2);
    expect(mockCallNativeStorage.mock.calls[1][0]).toEqual(
      expect.objectContaining({ store: 'devSettings' }),
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
    const storage = createNativeSyncStorageMirror('devSettings');

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
    const storage = createNativeSyncStorageMirror('devSettings');

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
          store: 'devSettings',
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

  it('applies bg broadcasts and replays them over an in-flight snapshot', async () => {
    let resolveBootstrap:
      | ((snapshot: {
          settings: [string, string][];
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
      devSettings: [],
    });
    await bootstrap;

    expect(storage.getString('key')).toBe('fresh-bg');
  });

  it('refreshes all mirrors after the bg runtime restarts', async () => {
    mockCallNativeStorage
      .mockResolvedValueOnce({
        settings: [['key', 'first-bg']],
        devSettings: [],
      })
      .mockResolvedValueOnce({
        settings: [['key', 'restarted-bg']],
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
      devSettings: [],
    });
    await Promise.resolve();
    expect(storage.getString('key')).toBeUndefined();

    resolveSecond?.({
      settings: [['key', 'fresh']],
      devSettings: [],
    });
    await Promise.all([first, retry]);

    expect(storage.getString('key')).toBe('fresh');
  });

  it('replays failed synchronous mutations in FIFO order after bg restart', async () => {
    mockCallNativeStorage
      .mockResolvedValueOnce({
        settings: [['key', 'initial-bg']],
        devSettings: [],
      })
      .mockRejectedValueOnce(new Error('background restarted'))
      .mockResolvedValueOnce({
        settings: [['key', 'stale-after-restart']],
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
      [{ scope: 'bootstrap', stores: ['settings', 'devSettings'] }],
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
      [{ scope: 'bootstrap', stores: ['settings', 'devSettings'] }],
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
