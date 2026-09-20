import { OneKeyLocalError } from '../../errors';

import { createMMKVSyncStorage } from './createMMKVSyncStorage';

import type {
  INativeSWRCachePatchIntent,
  INativeStorageBootstrapSnapshot,
  INativeStorageGlobal,
  INativeStorageRequest,
} from '../nativeStorageTypes';

const mockCallNativeStorage = jest.fn();
const mockApplyCanonicalEntries = jest.fn();

jest.mock('../../logger/logger', () => ({
  defaultLogger: {
    app: {
      background: { nativeStorageQueueState: jest.fn() },
      perf: { swrCacheSlowOp: jest.fn() },
    },
  },
}));
jest.mock('../../utils/resetUtils', () => ({
  default: { checkNotInResetting: jest.fn() },
}));
jest.mock('../nativeStorageBridge', () => ({
  callNativeStorage: (request: unknown): Promise<unknown> =>
    mockCallNativeStorage(request) as Promise<unknown>,
}));
jest.mock('../nativeSWRCachePersistence', () => {
  const actual = jest.requireActual<
    typeof import('../nativeSWRCachePersistence')
  >('../nativeSWRCachePersistence');
  return {
    ...actual,
    applyNativeSWRCacheCanonicalEntries: (
      ...args: Parameters<typeof actual.applyNativeSWRCacheCanonicalEntries>
    ) => {
      mockApplyCanonicalEntries(...args);
      return actual.applyNativeSWRCacheCanonicalEntries(...args);
    },
  };
});

const globals = globalThis as INativeStorageGlobal;
const emptySnapshot: INativeStorageBootstrapSnapshot = {
  settings: [],
  coldStart: [],
  devSettings: [],
};
const swrKey = 'onekey_swr_cache';
const entry = (value: number) => JSON.stringify({ d: value, t: value });
const patch = (value: number): INativeSWRCachePatchIntent => ({
  removePrefixes: [],
  removals: [],
  updates: [['same-key', entry(value)] as const],
});

function acknowledge(request: INativeStorageRequest) {
  if (request.scope === 'bootstrap') return emptySnapshot;
  if (request.scope !== 'syncStorage')
    throw new OneKeyLocalError('Unexpected request');
  if (request.operation === 'patchSWR') {
    return {
      store: request.store,
      operation: 'patchSWR',
      sourceMutationId: request.sourceMutationId,
      entries: [
        ...request.patch.removals.map(([key]) => [key, null]),
        ...request.patch.updates,
      ],
    };
  }
  return { ...request };
}

function loadMirror() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./nativeSyncStorageMirror') as typeof import('./nativeSyncStorageMirror');
}

describe('native sync storage backlog recovery', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    mockCallNativeStorage
      .mockReset()
      .mockImplementation(async (request: INativeStorageRequest) =>
        acknowledge(request),
      );
    mockApplyCanonicalEntries.mockClear();
    globals.__onekeyNativeStorageIsTransportReady = () => true;
    delete globals.__onekeyNativeSyncStorageTransportReady;
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete globals.__onekeyNativeStorageIsTransportReady;
    delete globals.__onekeyNativeSyncStorageTransportReady;
    delete globals.__onekeyNativeSyncStorageApplyMutation;
  });

  it('shares confirmation through the storage wrapper for 10000 same-key writes until bg acknowledges', async () => {
    const module = loadMirror();
    await module.bootstrapNativeSyncStorageMirrors();
    globals.__onekeyNativeStorageIsTransportReady = () => false;
    const storage = createMMKVSyncStorage(
      module.createNativeSyncStorageMirror('settings'),
    );
    const acknowledgements = new Set<void | Promise<void>>();
    for (let i = 0; i < 10_000; i += 1)
      acknowledgements.add(storage.set('key', i));
    expect(acknowledgements.size).toBe(1);
    let settled = false;
    void storage.set('key', 10_000)?.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    globals.__onekeyNativeStorageIsTransportReady = () => true;
    globals.__onekeyNativeSyncStorageTransportReady?.();
    await module.waitForNativeSyncStorageMutations();
    expect(settled).toBe(true);
    expect(storage.getNumber('key')).toBe(10_000);
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(2);
  });

  it('bounds confirmation groups while 10000 SWR updates compact', async () => {
    const module = loadMirror();
    await module.bootstrapNativeSyncStorageMirrors();
    globals.__onekeyNativeStorageIsTransportReady = () => false;
    const storage = module.createNativeSyncStorageMirror('coldStart');
    const acknowledgements = new Set<Promise<void>>();
    for (let i = 1; i <= 10_000; i += 1) {
      const acknowledgement = storage.applySWRCachePatch?.(patch(i));
      if (acknowledgement) acknowledgements.add(acknowledgement);
    }
    expect(acknowledgements.size).toBeLessThanOrEqual(100);
    globals.__onekeyNativeStorageIsTransportReady = () => true;
    globals.__onekeyNativeSyncStorageTransportReady?.();
    await module.waitForNativeSyncStorageMutations();
    await Promise.all(acknowledgements);
    expect(JSON.parse(storage.getString(swrKey) ?? '{}')).toEqual({
      'same-key': { d: 10_000, t: 10_000 },
    });
  });

  it('does not reject a refresh when pending SWR writes exceed the replay budget', async () => {
    const module = loadMirror();
    await module.bootstrapNativeSyncStorageMirrors();
    globals.__onekeyNativeStorageIsTransportReady = () => false;
    const storage = module.createNativeSyncStorageMirror('coldStart');

    for (let batch = 0; batch < 2; batch += 1) {
      void storage.applySWRCachePatch?.({
        removePrefixes: [],
        removals: [],
        updates: Array.from({ length: 501 }, (_, index) => {
          const key = `pending-${batch}-${index}`;
          return [
            key,
            JSON.stringify({ d: key, t: batch * 501 + index + 1 }),
          ] as const;
        }),
      });
    }

    await module.refreshNativeSyncStorageMirrors();

    const value = JSON.parse(storage.getString(swrKey) ?? '{}') as Record<
      string,
      unknown
    >;
    expect(Object.keys(value)).toHaveLength(1002);
    expect(value['pending-1-500']).toEqual({
      d: 'pending-1-500',
      t: 1002,
    });
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(2);
  });

  it('does not replay local writes into the in-flight snapshot budget', async () => {
    const module = loadMirror();
    await module.bootstrapNativeSyncStorageMirrors();
    globals.__onekeyNativeStorageIsTransportReady = () => false;
    let resolveSnapshot:
      | ((snapshot: INativeStorageBootstrapSnapshot) => void)
      | undefined;
    mockCallNativeStorage.mockImplementationOnce(
      () =>
        new Promise<INativeStorageBootstrapSnapshot>((resolve) => {
          resolveSnapshot = resolve;
        }),
    );
    const refresh = module.refreshNativeSyncStorageMirrors();
    const storage = module.createNativeSyncStorageMirror('coldStart');

    for (let batch = 0; batch < 2; batch += 1) {
      void storage.applySWRCachePatch?.({
        removePrefixes: [],
        removals: [],
        updates: Array.from({ length: 501 }, (_, index) => {
          const key = `in-flight-${batch}-${index}`;
          return [
            key,
            JSON.stringify({ d: key, t: batch * 501 + index + 1 }),
          ] as const;
        }),
      });
    }

    resolveSnapshot?.(emptySnapshot);
    await refresh;

    const value = JSON.parse(storage.getString(swrKey) ?? '{}') as Record<
      string,
      unknown
    >;
    expect(Object.keys(value)).toHaveLength(1002);
    expect(value['in-flight-1-500']).toEqual({
      d: 'in-flight-1-500',
      t: 1002,
    });
  });

  it('allows initial bootstrap with pending SWR writes over the replay budget', async () => {
    globals.__onekeyNativeStorageIsTransportReady = () => false;
    const module = loadMirror();
    const storage = module.createNativeSyncStorageMirror('coldStart');

    for (let batch = 0; batch < 2; batch += 1) {
      void storage.applySWRCachePatch?.({
        removePrefixes: [],
        removals: [],
        updates: Array.from({ length: 501 }, (_, index) => {
          const key = `pending-${batch}-${index}`;
          return [
            key,
            JSON.stringify({ d: key, t: batch * 501 + index + 1 }),
          ] as const;
        }),
      });
    }

    await module.bootstrapNativeSyncStorageMirrors();

    const value = JSON.parse(storage.getString(swrKey) ?? '{}') as Record<
      string,
      unknown
    >;
    expect(Object.keys(value)).toHaveLength(1002);
    expect(value['pending-1-500']).toEqual({
      d: 'pending-1-500',
      t: 1002,
    });
  });

  it('coalesces 10000 same-key broadcasts while a snapshot is in flight', async () => {
    let resolveSnapshot:
      | ((snapshot: INativeStorageBootstrapSnapshot) => void)
      | undefined;
    mockCallNativeStorage.mockImplementationOnce(
      () =>
        new Promise<INativeStorageBootstrapSnapshot>((resolve) => {
          resolveSnapshot = resolve;
        }),
    );
    const module = loadMirror();
    const bootstrap = module.bootstrapNativeSyncStorageMirrors();
    for (let i = 1; i <= 10_000; i += 1)
      globals.__onekeyNativeSyncStorageApplyMutation?.({
        store: 'coldStart',
        operation: 'patchSWR',
        entries: [['same-key', entry(i)]],
      });
    mockApplyCanonicalEntries.mockClear();
    resolveSnapshot?.({
      ...emptySnapshot,
      coldStart: [[swrKey, JSON.stringify({ retained: { d: 'bg', t: 1 } })]],
    });
    await bootstrap;
    expect(mockApplyCanonicalEntries.mock.calls.length).toBeLessThanOrEqual(1);
    expect(
      JSON.parse(
        module.createNativeSyncStorageMirror('coldStart').getString(swrKey) ??
          '{}',
      ),
    ).toEqual({
      retained: { d: 'bg', t: 1 },
      'same-key': { d: 10_000, t: 10_000 },
    });
  });

  it('ends a failed refresh window instead of replaying acknowledged writes later', async () => {
    const module = loadMirror();
    await module.bootstrapNativeSyncStorageMirrors();
    mockCallNativeStorage.mockRejectedValueOnce(new Error('snapshot timeout'));
    await expect(module.refreshNativeSyncStorageMirrors()).rejects.toThrow(
      'snapshot timeout',
    );
    const storage = module.createNativeSyncStorageMirror('coldStart');
    for (let i = 1; i <= 1000; i += 1) {
      await storage.applySWRCachePatch?.(patch(i));
      await module.waitForNativeSyncStorageMutations();
    }
    await module.waitForNativeSyncStorageMutations();
    mockCallNativeStorage.mockResolvedValueOnce({
      ...emptySnapshot,
      coldStart: [[swrKey, storage.getString(swrKey)]],
    });
    mockApplyCanonicalEntries.mockClear();
    await module.refreshNativeSyncStorageMirrors();
    expect(mockApplyCanonicalEntries).not.toHaveBeenCalled();
    expect(JSON.parse(storage.getString(swrKey) ?? '{}')).toEqual({
      'same-key': { d: 1000, t: 1000 },
    });
  });

  it('automatically retries a failed refresh with backoff', async () => {
    const module = loadMirror();
    await module.bootstrapNativeSyncStorageMirrors();
    mockCallNativeStorage.mockRejectedValueOnce(new Error('snapshot timeout'));
    await expect(module.refreshNativeSyncStorageMirrors()).rejects.toThrow();
    await jest.advanceTimersByTimeAsync(499);
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(3);
  });

  it('backs off repeated refresh failures and pauses retries while transport is unavailable', async () => {
    const module = loadMirror();
    await module.bootstrapNativeSyncStorageMirrors();
    mockCallNativeStorage.mockRejectedValueOnce(new Error('first timeout'));
    await expect(module.refreshNativeSyncStorageMirrors()).rejects.toThrow();
    mockCallNativeStorage.mockRejectedValueOnce(new Error('second timeout'));
    await jest.advanceTimersByTimeAsync(500);
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(3);
    globals.__onekeyNativeStorageIsTransportReady = () => false;
    await jest.advanceTimersByTimeAsync(10_000);
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(3);
    globals.__onekeyNativeStorageIsTransportReady = () => true;
    globals.__onekeyNativeSyncStorageTransportReady?.();
    globals.__onekeyNativeSyncStorageTransportReady?.();
    await jest.advanceTimersByTimeAsync(999);
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(3);
    await jest.advanceTimersByTimeAsync(1);
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(4);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(4);
  });

  it('does not retry initial startup failures behind the error UI', async () => {
    mockCallNativeStorage.mockRejectedValueOnce(new Error('initial timeout'));
    const module = loadMirror();
    await expect(module.bootstrapNativeSyncStorageMirrors()).rejects.toThrow(
      'initial timeout',
    );
    await jest.advanceTimersByTimeAsync(60_000);
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(1);
    await module.bootstrapNativeSyncStorageMirrors();
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(2);
  });

  it('propagates replacement failure to a snapshot that finished just before supersession', async () => {
    const module = loadMirror();
    let resolveSnapshot:
      | ((snapshot: INativeStorageBootstrapSnapshot) => void)
      | undefined;
    mockCallNativeStorage.mockImplementationOnce(
      () =>
        new Promise<INativeStorageBootstrapSnapshot>((resolve) => {
          resolveSnapshot = resolve;
        }),
    );
    const bootstrap = module.bootstrapNativeSyncStorageMirrors();
    resolveSnapshot?.(emptySnapshot);
    mockCallNativeStorage.mockRejectedValueOnce(
      new Error('replacement failed'),
    );
    const replacement = module.refreshNativeSyncStorageMirrors();
    await Promise.all([
      expect(bootstrap).rejects.toThrow('replacement failed'),
      expect(replacement).rejects.toThrow('replacement failed'),
    ]);
  });

  it('abandons an over-budget snapshot while keeping live data and unacknowledged writes', async () => {
    const module = loadMirror();
    await module.bootstrapNativeSyncStorageMirrors();
    let resolveStaleSnapshot:
      | ((snapshot: INativeStorageBootstrapSnapshot) => void)
      | undefined;
    mockCallNativeStorage.mockImplementationOnce(
      () =>
        new Promise<INativeStorageBootstrapSnapshot>((resolve) => {
          resolveStaleSnapshot = resolve;
        }),
    );
    const refresh = module.refreshNativeSyncStorageMirrors();
    globals.__onekeyNativeStorageIsTransportReady = () => false;
    const settings = module.createNativeSyncStorageMirror('settings');
    let acknowledged = false;
    void settings.set('pending', 'local').then(() => {
      acknowledged = true;
    });
    for (let i = 0; i <= 1000; i += 1) {
      globals.__onekeyNativeSyncStorageApplyMutation?.({
        store: 'coldStart',
        operation: 'patchSWR',
        entries: [[`removed-${i}`, null]],
      });
    }
    globals.__onekeyNativeSyncStorageApplyMutation?.({
      store: 'settings',
      operation: 'set',
      key: 'live',
      value: 'latest',
    });
    await expect(refresh).rejects.toThrow('snapshot replay budget exceeded');
    expect(settings.getString('pending')).toBe('local');
    expect(settings.getString('live')).toBe('latest');
    expect(acknowledged).toBe(false);
    mockCallNativeStorage.mockResolvedValueOnce({
      ...emptySnapshot,
      settings: [['live', 'fresh-bg']],
    });
    mockApplyCanonicalEntries.mockClear();
    await module.refreshNativeSyncStorageMirrors();
    expect(mockApplyCanonicalEntries).not.toHaveBeenCalled();
    expect(settings.getString('pending')).toBe('local');
    resolveStaleSnapshot?.({
      ...emptySnapshot,
      settings: [['live', 'stale-bg']],
    });
    await jest.advanceTimersByTimeAsync(0);
    expect(settings.getString('live')).toBe('fresh-bg');
    globals.__onekeyNativeStorageIsTransportReady = () => true;
    globals.__onekeyNativeSyncStorageTransportReady?.();
    await module.waitForNativeSyncStorageMutations();
    expect(acknowledged).toBe(true);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(4);
  });

  it('keeps in-flight confirmation separate and resolves compacted writes only after clear is durable', async () => {
    const module = loadMirror();
    await module.bootstrapNativeSyncStorageMirrors();
    const responses: Array<() => void> = [];
    mockCallNativeStorage.mockImplementation(
      (request: INativeStorageRequest) =>
        new Promise<unknown>((resolve) => {
          responses.push(() => resolve(acknowledge(request)));
        }),
    );
    const storage = module.createNativeSyncStorageMirror('settings');
    const inFlight = storage.set('key', 1);
    const pending = storage.set('key', 2);
    const clear = storage.clearAll();
    expect(pending).toBe(clear);
    expect(inFlight).not.toBe(clear);
    let cleared = false;
    void clear.then(() => {
      cleared = true;
    });
    responses[0]();
    await inFlight;
    expect(cleared).toBe(false);
    expect(storage.getAllKeys()).toEqual([]);
    responses[1]();
    await module.waitForNativeSyncStorageMutations();
    expect(cleared).toBe(true);
    expect(mockCallNativeStorage).toHaveBeenLastCalledWith(
      expect.objectContaining({ operation: 'clear' }),
    );
  });
});
