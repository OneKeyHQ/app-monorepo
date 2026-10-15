import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IFetchStreamRequest,
  IFetchStreamResult,
} from '@onekeyhq/shared/types/fetchStream';

import {
  createPrivacyChainWorkerClient,
  createWorkerHostStreamRequester,
  servePrivacyChainWorker,
  workerCarrierHasHostStreamRequest,
} from './privacyChainWorkerClient';

const open: IFetchStreamRequest = {
  action: 'open',
  url: 'https://node.example',
  headers: [],
  b64: '',
};
const opened: IFetchStreamResult = {
  ok: true,
  response: { id: 'stream-1', status: 200, statusText: 'OK', headers: [] },
};

describe('privacy chain worker streams', () => {
  const scope = globalThis as unknown as {
    onmessage: ((event: MessageEvent) => void) | null;
    postMessage: (message: unknown) => void;
    addEventListener: (type: string, fn: (event: MessageEvent) => void) => void;
  };
  const saved = {
    onmessage: scope.onmessage,
    postMessage: scope.postMessage,
    addEventListener: scope.addEventListener,
  };
  afterEach(() => {
    Object.assign(scope, saved);
    jest.useRealTimers();
  });

  it('advertises stream support independently of legacy byte requests', async () => {
    scope.postMessage = jest.fn();
    servePrivacyChainWorker({
      label: 'zcash',
      methods: [],
      loadApi: async () => ({}),
    });
    scope.onmessage?.({
      data: { id: 1, method: 'ping', args: [{ hostStreamRequest: true }] },
    } as MessageEvent);
    expect(workerCarrierHasHostStreamRequest()).toBe(true);
    scope.onmessage?.({
      data: { id: 2, method: 'ping', args: [] },
    } as MessageEvent);
    expect(workerCarrierHasHostStreamRequest()).toBe(false);
  });

  it('bounds a lost reply and cancels a late open result', async () => {
    jest.useFakeTimers();
    const messages: {
      requestId: number;
      request: IFetchStreamRequest;
    }[] = [];
    let receive: ((event: MessageEvent) => void) | undefined;
    scope.postMessage = (message) =>
      messages.push(message as (typeof messages)[number]);
    scope.addEventListener = (_type, fn) => {
      receive = fn;
    };
    const requester = createWorkerHostStreamRequester(100);
    const result = requester(open);
    jest.advanceTimersByTime(100);
    await expect(result).resolves.toEqual({
      ok: false,
      error: 'fetch stream host timed out',
    });
    receive?.({
      data: {
        type: 'host-stream-response',
        requestId: messages[0].requestId,
        result: opened,
      },
    } as MessageEvent);
    expect(messages[1].request).toEqual({ action: 'cancel', id: 'stream-1' });
    receive?.({
      data: {
        type: 'host-stream-response',
        requestId: messages[1].requestId,
        result: { ok: true, cancelled: true },
      },
    } as MessageEvent);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([
    [false, false],
    [true, false],
    [false, true],
  ])(
    'releases host streams on reset (late headers: %s, read bridge throws: %s)',
    async (late, readThrows) => {
      const replies: unknown[] = [];
      const worker = {
        onmessage: null as ((event: MessageEvent) => void) | null,
        onerror: null,
        onmessageerror: null,
        terminate: jest.fn(),
        postMessage(message: { id?: number; method?: string }) {
          replies.push(message);
          if (message.method === 'ping')
            queueMicrotask(() =>
              worker.onmessage?.({
                data: { id: message.id, ok: true, result: 'pong' },
              } as MessageEvent),
            );
        },
      };
      let release: ((result: IFetchStreamResult) => void) | undefined;
      const host = jest.fn(
        async (request: IFetchStreamRequest): Promise<IFetchStreamResult> => {
          if (readThrows && request.action === 'read')
            throw new OneKeyLocalError('host bridge disconnected');
          if (request.action !== 'open') return { ok: true, cancelled: true };
          return new Promise((resolve) => {
            release = resolve;
          });
        },
      );
      const client = createPrivacyChainWorkerClient({
        label: 'zcash',
        methods: [],
        createWorker: () => worker as unknown as Worker,
        hostStreamRequest: host,
      });
      await client.ensureReady();
      worker.onmessage?.({
        data: { type: 'host-stream-request', requestId: 9, request: open },
      } as MessageEvent);
      if (late) client.reset();
      release?.(opened);
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (readThrows) {
        worker.onmessage?.({
          data: {
            type: 'host-stream-request',
            requestId: 10,
            request: { action: 'read', id: 'stream-1' },
          },
        } as MessageEvent);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(replies).toContainEqual({
          type: 'host-stream-response',
          requestId: 10,
          result: { ok: false, error: 'host bridge disconnected' },
        });
      }
      if (!late) client.reset();
      expect(host).toHaveBeenLastCalledWith({
        action: 'cancel',
        id: 'stream-1',
      });
      expect(
        host.mock.calls.filter(([request]) => request.action === 'cancel'),
      ).toHaveLength(1);
      expect(worker.terminate).toHaveBeenCalledTimes(1);
      if (late) expect(replies).toHaveLength(1);
    },
  );
});
