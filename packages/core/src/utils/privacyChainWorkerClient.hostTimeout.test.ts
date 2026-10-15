import { createWorkerHostRequester } from './privacyChainWorkerClient';

/**
 * A node request relayed through the host must end. Before this bound, one
 * stalled connection -- or an extension background recycled mid-request, so
 * its reply never came -- left the runtime step waiting forever, and the
 * chain never scanned again until a restart.
 */
describe('worker host requester', () => {
  const listeners: ((event: MessageEvent) => void)[] = [];
  const posted: { requestId: number }[] = [];
  const scope = globalThis as unknown as Record<string, unknown>;
  const saved = {
    postMessage: scope.postMessage,
    addEventListener: scope.addEventListener,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    listeners.length = 0;
    posted.length = 0;
    scope.postMessage = (message: { requestId: number }) => {
      posted.push(message);
    };
    scope.addEventListener = (
      _type: string,
      fn: (event: MessageEvent) => void,
    ) => {
      listeners.push(fn);
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    scope.postMessage = saved.postMessage;
    scope.addEventListener = saved.addEventListener;
  });

  function reply(requestId: number, bytes: number[]) {
    for (const fn of listeners) {
      fn({
        data: {
          type: 'host-response',
          requestId,
          ok: true,
          bytes: new Uint8Array(bytes),
        },
      } as MessageEvent);
    }
  }

  it('rejects a request the host never answers', async () => {
    const request = createWorkerHostRequester('xmr', 1000);
    const pending = request(
      'https://node.example/x',
      'application/json',
      new Uint8Array(),
    );
    jest.advanceTimersByTime(1000);
    await expect(pending).rejects.toThrow('host fetch timed out after 1000ms');
  });

  it('delivers an answer that arrives in time, and ignores a late one', async () => {
    const request = createWorkerHostRequester('xmr', 1000);
    const first = request(
      'https://node.example/a',
      'application/json',
      new Uint8Array(),
    );
    reply(posted[0].requestId, [1, 2]);
    await expect(first).resolves.toEqual(new Uint8Array([1, 2]));

    const second = request(
      'https://node.example/b',
      'application/json',
      new Uint8Array(),
    );
    jest.advanceTimersByTime(1000);
    await expect(second).rejects.toThrow('timed out');
    // The reply that finally shows up has no waiter left and changes nothing.
    expect(() => reply(posted[1].requestId, [3])).not.toThrow();
  });
});
