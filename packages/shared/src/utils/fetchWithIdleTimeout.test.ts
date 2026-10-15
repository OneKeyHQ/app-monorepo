import { fetchBytesWithIdleTimeout } from './fetchWithIdleTimeout';

/**
 * A slow but steady transfer must never be cut off; only silence ends it.
 * The body is a scripted reader so the test controls exactly when bytes arrive.
 */
function fakeResponse(
  schedule: { atMs: number; bytes: number[] }[],
  signal: AbortSignal,
) {
  let index = 0;
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    body: {
      getReader: () => ({
        read: () =>
          new Promise<{ done: boolean; value?: Uint8Array }>(
            (resolve, reject) => {
              const onAbort = () => reject(signal.reason);
              signal.addEventListener('abort', onAbort, { once: true });
              const next = schedule[index];
              if (!next) {
                resolve({ done: true });
                return;
              }
              index += 1;
              setTimeout(() => {
                signal.removeEventListener('abort', onAbort);
                resolve({ done: false, value: new Uint8Array(next.bytes) });
              }, next.atMs);
            },
          ),
      }),
    },
  };
}

describe('fetchBytesWithIdleTimeout', () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    globalThis.fetch = realFetch;
  });

  it('keeps waiting while bytes keep arriving, however long it takes', async () => {
    // Ten chunks, 20 s apart: 200 s in total, never 30 s of silence.
    const schedule = Array.from({ length: 10 }, (_, i) => ({
      atMs: 20_000,
      bytes: [i],
    }));
    globalThis.fetch = jest.fn(async (_url: unknown, init?: RequestInit) =>
      fakeResponse(schedule, init?.signal as AbortSignal),
    ) as unknown as typeof fetch;

    const pending = fetchBytesWithIdleTimeout('https://node', {}, 30_000);
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await jest.advanceTimersByTimeAsync(20_000);
    }
    const result = await pending;
    expect(Array.from(result.bytes)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('gives up once nothing has arrived for the idle window', async () => {
    const schedule = [
      { atMs: 1000, bytes: [1] },
      { atMs: 60_000, bytes: [2] },
    ];
    globalThis.fetch = jest.fn(async (_url: unknown, init?: RequestInit) =>
      fakeResponse(schedule, init?.signal as AbortSignal),
    ) as unknown as typeof fetch;

    const pending = fetchBytesWithIdleTimeout('https://node', {}, 30_000);
    // Attach the handler before the timers fire so the rejection is caught.
    const settled = pending.then(
      () => 'resolved',
      (error: unknown) =>
        error instanceof Error ? error.message : String(error),
    );
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(30_000);
    await expect(settled).resolves.toContain('no data from the node');
  });

  it.each([false, true])(
    'aborts oversized responses before merging (declared length: %s)',
    async (declared) => {
      let signal: AbortSignal | null | undefined;
      const cancel = jest.fn();
      const fetchImpl: typeof fetch = async (_input, init) => {
        signal = init?.signal;
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(17));
            },
            cancel,
          }),
          { headers: declared ? { 'content-length': '17' } : {} },
        );
      };
      await expect(
        fetchBytesWithIdleTimeout('https://node', {}, 30_000, fetchImpl, 16),
      ).rejects.toThrow('node response exceeds size limit');
      expect(signal?.aborted).toBe(true);
      if (!declared) expect(cancel).toHaveBeenCalledTimes(1);
    },
  );

  it('propagates caller cancellation during a pending read', async () => {
    const caller = new AbortController();
    const fetchImpl = jest.fn(async (_url: unknown, init?: RequestInit) =>
      fakeResponse([{ atMs: 60_000, bytes: [1] }], init?.signal as AbortSignal),
    ) as unknown as typeof fetch;
    const pending = fetchBytesWithIdleTimeout(
      'https://node',
      { signal: caller.signal },
      30_000,
      fetchImpl,
    );
    const settled = pending.catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(1);
    const reason = new Error('cancelled by caller');
    caller.abort(reason);
    await expect(settled).resolves.toBe(reason);
    expect(jest.getTimerCount()).toBe(1);
  });
});
