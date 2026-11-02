import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { withWalletLease } from '../chains/zcash/sdkZcash/impl/carrier';

import {
  createPrivacyChainWorkerClient,
  getPrivacyChainRuntimeFailure,
  servePrivacyChainWorker,
} from './privacyChainWorkerClient';

type ITestApi = {
  scan: () => number | Promise<number>;
  wait: () => Promise<void>;
};

describe('privacy chain Worker restart', () => {
  const scope = globalThis as unknown as {
    onmessage: ((event: MessageEvent) => void) | null;
    postMessage: (message: unknown) => void;
  };
  const saved = {
    onmessage: scope.onmessage,
    postMessage: scope.postMessage,
  };
  const clients: { reset: () => void }[] = [];

  afterEach(() => {
    for (const client of clients) client.reset();
    clients.length = 0;
    Object.assign(scope, saved);
  });

  function createClient(options: {
    scan: ITestApi['scan'];
    loadApi?: () => Promise<ITestApi>;
    storageRequiresRestart?: () => boolean;
  }) {
    const workers: {
      onmessage: ((event: MessageEvent) => void) | null;
      onerror: null;
      onmessageerror: null;
      postMessage: (message: unknown) => void;
      terminate: jest.Mock<void, []>;
    }[] = [];
    const client = createPrivacyChainWorkerClient<ITestApi>({
      label: 'test',
      methods: ['scan', 'wait'],
      createWorker: () => {
        const worker: (typeof workers)[number] = {
          onmessage: null,
          onerror: null,
          onmessageerror: null,
          terminate: jest.fn(),
          postMessage: () => undefined,
        };
        scope.postMessage = (message) => {
          queueMicrotask(() => {
            if (!worker.terminate.mock.calls.length) {
              worker.onmessage?.({ data: message } as MessageEvent);
            }
          });
        };
        servePrivacyChainWorker<ITestApi>({
          label: 'test',
          methods: ['scan', 'wait'],
          loadApi:
            options.loadApi ??
            (async () => ({
              scan: options.scan,
              wait: () => new Promise<void>(() => undefined),
            })),
          storageRequiresRestart: options.storageRequiresRestart,
        });
        const receive = scope.onmessage;
        worker.postMessage = (message) => {
          queueMicrotask(() => {
            if (!worker.terminate.mock.calls.length) {
              receive?.({ data: message } as MessageEvent);
            }
          });
        };
        workers.push(worker);
        return worker as unknown as Worker;
      },
    });
    clients.push(client);
    return { client, workers };
  }

  it('retires a trapped Worker and uses a fresh Worker on the next call without replay', async () => {
    const trap = Object.assign(new WebAssembly.RuntimeError('unreachable'), {
      data: { diagnostic: 'synthetic' },
      payload: { detail: 'synthetic trap detail' },
    });
    const scan = jest.fn<number, []>().mockImplementationOnce(() => {
      throw trap;
    });
    scan.mockReturnValue(42);
    const { client, workers } = createClient({ scan });

    const waiting = client.api.wait().catch((error: unknown) => error);
    const trapped = client.api.scan();
    await expect(trapped).rejects.toMatchObject({
      name: 'RuntimeError',
      message: 'unreachable',
      data: {
        diagnostic: 'synthetic',
        privacyChainRuntimeFailure: 'trapped',
      },
      payload: { detail: 'synthetic trap detail' },
    });
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
    expect(getPrivacyChainRuntimeFailure(await waiting)).toBe('trapped');
    expect(scan).toHaveBeenCalledTimes(1);
    expect(workers).toHaveLength(1);

    await expect(client.api.scan()).resolves.toBe(42);
    expect(workers).toHaveLength(2);
    expect(workers[1].terminate).not.toHaveBeenCalled();
    expect(scan).toHaveBeenCalledTimes(2);
  });

  it('keeps a Worker available after an ordinary runtime error', async () => {
    const scan = jest.fn<number, []>().mockImplementationOnce(() => {
      throw new OneKeyLocalError('network unavailable');
    });
    scan.mockReturnValue(42);
    const { client, workers } = createClient({ scan });

    await expect(client.api.scan()).rejects.toThrow('network unavailable');
    await expect(client.api.scan()).resolves.toBe(42);
    expect(workers).toHaveLength(1);
    expect(workers[0].terminate).not.toHaveBeenCalled();
  });

  it('does not run queued exports after a trap while termination is pending', async () => {
    const scan = jest.fn<number, []>().mockImplementationOnce(() => {
      throw new WebAssembly.RuntimeError('unreachable');
    });
    scan.mockReturnValue(42);
    const { client, workers } = createClient({ scan });

    const results = await Promise.allSettled([
      client.api.scan(),
      client.api.scan(),
    ]);
    expect(results.map((result) => result.status)).toEqual([
      'rejected',
      'rejected',
    ]);
    expect(scan).toHaveBeenCalledTimes(1);
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
  });

  it('blocks calls already admitted to the wallet lease when an async export traps', async () => {
    let releaseScan: () => void = () => undefined;
    const scanGate = new Promise<void>((resolve) => {
      releaseScan = resolve;
    });
    let markQueued: () => void = () => undefined;
    const queued = new Promise<void>((resolve) => {
      markQueued = resolve;
    });
    const exportCall = jest.fn(async () => {
      await scanGate;
      throw new WebAssembly.RuntimeError('unreachable');
    });
    let admitted = 0;
    const { client, workers } = createClient({
      scan: () => {
        admitted += 1;
        const result = withWalletLease(exportCall);
        if (admitted === 2) markQueued();
        return result;
      },
    });

    const results = Promise.allSettled([client.api.scan(), client.api.scan()]);
    await queued;
    expect(exportCall).toHaveBeenCalledTimes(1);
    releaseScan();

    expect((await results).map((result) => result.status)).toEqual([
      'rejected',
      'rejected',
    ]);
    expect(exportCall).toHaveBeenCalledTimes(1);
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
  });

  it('keeps the wallet lease usable after an ordinary queued error', async () => {
    const exportCall = jest
      .fn<Promise<number>, []>()
      .mockRejectedValueOnce(new OneKeyLocalError('network unavailable'))
      .mockResolvedValue(42);
    const { client, workers } = createClient({
      scan: () => withWalletLease(exportCall),
    });

    const results = await Promise.allSettled([
      client.api.scan(),
      client.api.scan(),
    ]);
    expect(results).toMatchObject([
      { status: 'rejected', reason: { message: 'network unavailable' } },
      { status: 'fulfilled', value: 42 },
    ]);
    expect(workers[0].terminate).not.toHaveBeenCalled();
    expect(exportCall).toHaveBeenCalledTimes(2);
  });

  it('replaces a Worker that traps while loading its API', async () => {
    const scan = jest.fn(() => 42);
    const loadApi = jest
      .fn<Promise<ITestApi>, []>()
      .mockRejectedValueOnce(new WebAssembly.RuntimeError('unreachable'))
      .mockResolvedValue({ scan, wait: async () => undefined });
    const { client, workers } = createClient({ scan, loadApi });

    await expect(client.api.scan()).rejects.toMatchObject({
      name: 'RuntimeError',
      message: 'unreachable',
    });
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
    expect(scan).not.toHaveBeenCalled();

    await expect(client.api.scan()).resolves.toBe(42);
    expect(workers).toHaveLength(2);
    expect(scan).toHaveBeenCalledTimes(1);
  });

  it('does not poison a replacement Worker when an abandoned call traps late', async () => {
    let releaseScan: () => void = () => undefined;
    let markStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const scanGate = new Promise<void>((resolve) => {
      releaseScan = resolve;
    });
    const scan = jest
      .fn<number | Promise<number>, []>()
      .mockImplementationOnce(async () => {
        markStarted();
        await scanGate;
        throw new WebAssembly.RuntimeError('unreachable');
      })
      .mockReturnValue(42);
    const { client, workers } = createClient({ scan });

    const abandoned = Promise.resolve(client.api.scan()).catch(
      (error: unknown) => error,
    );
    await started;
    client.reset();
    expect(getPrivacyChainRuntimeFailure(await abandoned)).toBe('reset');
    await expect(client.api.scan()).resolves.toBe(42);

    releaseScan();
    await scanGate;
    await expect(client.api.scan()).resolves.toBe(42);
    expect(workers).toHaveLength(2);
    expect(workers[1].terminate).not.toHaveBeenCalled();
  });

  it('keeps storage failures distinct and preserves a finished response', async () => {
    let storageFailed = false;
    const { client, workers } = createClient({
      scan: () => {
        storageFailed = true;
        return 42;
      },
      storageRequiresRestart: () => storageFailed,
    });

    const waiting = client.api.wait().catch((error: unknown) => error);
    await expect(client.api.scan()).resolves.toBe(42);
    expect(getPrivacyChainRuntimeFailure(await waiting)).toBe('storage');
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
  });
});
