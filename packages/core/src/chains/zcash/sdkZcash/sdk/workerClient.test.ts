import type { IZcashSdkApi } from '../types/sdk';

type ICall = { id: number; method: string; args: unknown[] };

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;

  onerror: ((event?: { message: string }) => void) | null = null;

  onmessageerror: (() => void) | null = null;

  terminate = jest.fn();

  postMessage = jest.fn<void, [ICall]>();

  reply(index: number, result: unknown = true) {
    const [call] = this.postMessage.mock.calls[index];
    this.onmessage?.({
      data: { id: call.id, ok: true, result },
    } as MessageEvent);
  }
}

describe('shared Zcash Worker lifecycle', () => {
  let api: IZcashSdkApi;
  let workers: MockWorker[];

  beforeEach(async () => {
    jest.resetModules();
    workers = [];
    jest.doMock('./createZcashWorker', () => ({
      __esModule: true,
      default: () => {
        const worker = new MockWorker();
        workers.push(worker);
        return worker;
      },
    }));
    ({ workerApi: api } = await import('./workerClient'));
  });

  afterEach(async () => {
    await api.resetCarrier();
    jest.useRealTimers();
    jest.dontMock('./createZcashWorker');
  });

  const request = (apiInstance: IZcashSdkApi) =>
    apiInstance.getChainTip({
      network: 'main',
      lightwalletdUrl: 'https://example.invalid',
    });

  it('preserves the Worker startup error instead of reporting a handshake timeout', async () => {
    const pending = request(api);
    workers[0].onerror?.({ message: 'bootstrap failed' });
    await expect(pending).rejects.toThrow('crashed: bootstrap failed');
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
    expect(workers).toHaveLength(1);
  });

  it('shares one handshake and rejects concurrent requests on a crash without replay', async () => {
    const first = request(api);
    const second = request(api);
    const settled = Promise.allSettled([first, second]);
    expect(workers).toHaveLength(1);
    expect(workers[0].postMessage).toHaveBeenCalledTimes(1);
    workers[0].reply(0);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(workers[0].postMessage).toHaveBeenCalledTimes(3);
    workers[0].onerror?.();
    expect(await settled).toEqual([
      {
        status: 'rejected',
        reason: expect.objectContaining({
          message: expect.stringContaining('crashed'),
        }),
      },
      {
        status: 'rejected',
        reason: expect.objectContaining({
          message: expect.stringContaining('crashed'),
        }),
      },
    ]);
    expect(workers).toHaveLength(1);
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);

    const next = request(api);
    expect(workers).toHaveLength(2);
    workers[1].reply(0);
    await new Promise<void>((resolve) => setImmediate(resolve));
    workers[1].reply(1, 42);
    await expect(next).resolves.toBe(42);
  });

  it('does not dispatch a request when reset races with handshake completion', async () => {
    const pending = request(api);
    const rejected = pending.catch((error: unknown) => error);
    workers[0].reply(0);
    await api.resetCarrier();
    expect(await rejected).toMatchObject({
      message: expect.stringContaining('carrier reset'),
    });
    expect(workers[0].postMessage).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])(
    'retires poisoned storage while preserving the current response (ok=%s)',
    async (ok) => {
      const current = request(api);
      const queued = request(api);
      const settled = Promise.allSettled([current, queued]);
      workers[0].reply(0);
      await new Promise<void>((resolve) => setImmediate(resolve));
      const [call] = workers[0].postMessage.mock.calls[1];
      workers[0].onmessage?.({
        data: {
          id: call.id,
          ok,
          result: { txid: 'known-transaction', broadcastState: 'unknown' },
          error: { message: 'disk I/O error', code: 'DATABASE_ERROR' },
          requiresWorkerRestart: true,
        },
      } as MessageEvent);
      const [completed, cancelled] = await settled;
      expect(completed).toEqual(
        ok
          ? {
              status: 'fulfilled',
              value: { txid: 'known-transaction', broadcastState: 'unknown' },
            }
          : {
              status: 'rejected',
              reason: expect.objectContaining({ code: 'DATABASE_ERROR' }),
            },
      );
      expect(cancelled).toEqual({
        status: 'rejected',
        reason: expect.objectContaining({
          message: expect.stringContaining('storage failed'),
        }),
      });
      expect(workers[0].terminate).toHaveBeenCalledTimes(1);
      expect(workers).toHaveLength(1);
    },
  );

  it('terminates an unresponsive handshake and allows a later explicit retry', async () => {
    jest.useFakeTimers();
    const pending = request(api);
    const rejected = pending.catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(15_000);
    expect(await rejected).toMatchObject({
      message: expect.stringContaining('handshake timed out'),
    });
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
    expect(workers).toHaveLength(1);
  });

  it('rejects an invalid response and preserves structured call errors', async () => {
    const pending = request(api);
    const rejected = pending.catch((error: unknown) => error);
    workers[0].reply(0);
    await new Promise<void>((resolve) => setImmediate(resolve));
    const [call] = workers[0].postMessage.mock.calls[1];
    workers[0].onmessage?.({
      data: {
        id: call.id,
        ok: false,
        error: { message: 'database busy', code: 'DatabaseError' },
      },
    } as MessageEvent);
    expect(await rejected).toMatchObject({
      message: 'database busy',
      code: 'DatabaseError',
    });
    const next = request(api);
    const invalid = next.catch((error: unknown) => error);
    await Promise.resolve();
    workers[0].onmessageerror?.();
    expect(await invalid).toMatchObject({
      message: expect.stringContaining('invalid response'),
    });
  });
});
