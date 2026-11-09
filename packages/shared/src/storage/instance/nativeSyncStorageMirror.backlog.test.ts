import { OneKeyLocalError } from '../../errors';

import { createMMKVSyncStorage } from './createMMKVSyncStorage';

import type {
  INativeStorageBootstrapSnapshot,
  INativeStorageGlobal,
  INativeStorageRequest,
} from '../nativeStorageTypes';

const mockCallNativeStorage = jest.fn();
const mockNativeStorageSnapshotState = jest.fn();

jest.mock('../../logger/logger', () => ({
  defaultLogger: {
    app: {
      background: {
        nativeStorageQueueState: jest.fn(),
        nativeStorageSnapshotState: (params: unknown) => {
          mockNativeStorageSnapshotState(params);
        },
      },
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
const globals = globalThis as INativeStorageGlobal;
const emptySnapshot: INativeStorageBootstrapSnapshot = {
  settings: [],
  devSettings: [],
};

function acknowledge(request: INativeStorageRequest) {
  if (request.scope === 'bootstrap') return emptySnapshot;
  if (request.scope !== 'syncStorage')
    throw new OneKeyLocalError('Unexpected request');
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
    mockNativeStorageSnapshotState.mockReset();
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
        store: 'settings',
        operation: 'set',
        key: 'same-key',
        value: i,
      });
    resolveSnapshot?.({
      ...emptySnapshot,
      settings: [
        ['retained', 'bg'],
        ['same-key', 0],
      ],
    });
    await bootstrap;
    const storage = module.createNativeSyncStorageMirror('settings');
    expect(storage.getString('retained')).toBe('bg');
    expect(storage.getNumber('same-key')).toBe(10_000);
  });

  it('keeps the mirror authoritative while a refresh is in flight or after it fails', async () => {
    const module = loadMirror();
    await module.bootstrapNativeSyncStorageMirrors();
    expect(module.isNativeSyncStorageMirrorBootstrapped()).toBe(true);
    let rejectSnapshot: ((error: Error) => void) | undefined;
    mockCallNativeStorage.mockImplementationOnce(
      () =>
        new Promise<INativeStorageBootstrapSnapshot>((_resolve, reject) => {
          rejectSnapshot = reject;
        }),
    );
    const refresh = module.refreshNativeSyncStorageMirrors();
    expect(module.isNativeSyncStorageMirrorBootstrapped()).toBe(true);
    rejectSnapshot?.(new Error('snapshot timeout'));
    await expect(refresh).rejects.toThrow('snapshot timeout');
    expect(module.isNativeSyncStorageMirrorBootstrapped()).toBe(true);
  });

  it('ends a failed refresh window instead of replaying acknowledged writes later', async () => {
    const module = loadMirror();
    await module.bootstrapNativeSyncStorageMirrors();
    mockCallNativeStorage.mockRejectedValueOnce(new Error('snapshot timeout'));
    await expect(module.refreshNativeSyncStorageMirrors()).rejects.toThrow(
      'snapshot timeout',
    );
    const storage = module.createNativeSyncStorageMirror('settings');
    for (let i = 1; i <= 1000; i += 1) {
      await storage.set('same-key', i);
      await module.waitForNativeSyncStorageMutations();
    }
    // bg has since moved on; its snapshot must not be overwritten by writes
    // that were acknowledged after the failed refresh ended.
    globals.__onekeyNativeSyncStorageApplyMutation?.({
      store: 'settings',
      operation: 'remove',
      key: 'same-key',
    });
    mockCallNativeStorage.mockResolvedValueOnce({
      ...emptySnapshot,
      settings: [['same-key', 'bg-latest']],
    });
    await module.refreshNativeSyncStorageMirrors();
    expect(storage.getString('same-key')).toBe('bg-latest');
  });

  it('keeps live data and unacknowledged writes when a refresh fails', async () => {
    const module = loadMirror();
    await module.bootstrapNativeSyncStorageMirrors();
    let rejectSnapshot: ((error: Error) => void) | undefined;
    mockCallNativeStorage.mockImplementationOnce(
      () =>
        new Promise<INativeStorageBootstrapSnapshot>((_resolve, reject) => {
          rejectSnapshot = reject;
        }),
    );
    const refresh = module.refreshNativeSyncStorageMirrors();
    globals.__onekeyNativeStorageIsTransportReady = () => false;
    const settings = module.createNativeSyncStorageMirror('settings');
    let acknowledged = false;
    void settings.set('pending', 'local').then(() => {
      acknowledged = true;
    });
    globals.__onekeyNativeSyncStorageApplyMutation?.({
      store: 'settings',
      operation: 'set',
      key: 'live',
      value: 'latest',
    });
    rejectSnapshot?.(new Error('snapshot timeout'));
    await expect(refresh).rejects.toThrow('snapshot timeout');
    expect(settings.getString('pending')).toBe('local');
    expect(settings.getString('live')).toBe('latest');
    expect(acknowledged).toBe(false);

    mockCallNativeStorage.mockResolvedValueOnce({
      ...emptySnapshot,
      settings: [['live', 'fresh-bg']],
    });
    await module.refreshNativeSyncStorageMirrors();
    expect(settings.getString('pending')).toBe('local');
    expect(settings.getString('live')).toBe('fresh-bg');

    globals.__onekeyNativeStorageIsTransportReady = () => true;
    globals.__onekeyNativeSyncStorageTransportReady?.();
    await module.waitForNativeSyncStorageMutations();
    expect(acknowledged).toBe(true);
    expect(settings.getString('pending')).toBe('local');
    await jest.advanceTimersByTimeAsync(60_000);
    expect(mockCallNativeStorage).toHaveBeenCalledTimes(4);
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
    expect(mockNativeStorageSnapshotState).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'failed', failedAttemptCount: 1 }),
    );
    expect(mockNativeStorageSnapshotState).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'recovered',
        failedAttemptCount: 1,
      }),
    );
  });

  it('suppresses repeated snapshot failures during the diagnostic cooldown', async () => {
    const module = loadMirror();
    await module.bootstrapNativeSyncStorageMirrors();
    mockCallNativeStorage
      .mockRejectedValueOnce(new Error('first snapshot timeout'))
      .mockRejectedValueOnce(new Error('second snapshot timeout'));

    await expect(module.refreshNativeSyncStorageMirrors()).rejects.toThrow();
    await expect(module.refreshNativeSyncStorageMirrors()).rejects.toThrow();

    expect(mockNativeStorageSnapshotState).toHaveBeenCalledTimes(1);
    expect(mockNativeStorageSnapshotState).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCount: 1,
        eventType: 'failed',
      }),
    );
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
    expect(module.isNativeSyncStorageMirrorBootstrapped()).toBe(false);
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
