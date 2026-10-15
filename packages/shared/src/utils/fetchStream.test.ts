import { OneKeyLocalError } from '../errors';

import {
  FETCH_STREAM_CHUNK_BYTES,
  FETCH_STREAM_MAX_ACTIVE,
  createFetchStreamHandler,
} from './fetchStream';
import { FETCH_RESPONSE_MAX_BYTES } from './fetchWithIdleTimeout';

import type { IFetchStreamRequest } from '../../types/fetchStream';

const request: IFetchStreamRequest = {
  action: 'open',
  method: 'POST',
  url: 'https://node.example/rpc',
  headers: [],
  b64: '',
};

describe('HTTP host streams', () => {
  it.each(['GET', 'HEAD'])(
    'rejects a body on %s before opening a host connection',
    async (method) => {
      const fetchImpl = jest.fn();
      await expect(
        createFetchStreamHandler(fetchImpl)({ ...request, method }),
      ).resolves.toEqual({
        ok: false,
        error: 'fetch GET/HEAD requests cannot have a body',
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it.each(['CONNECT', 'TRACE', 'invalid method'])(
    'rejects unsupported HTTP method %s before opening a host connection',
    async (method) => {
      const fetchImpl = jest.fn();
      await expect(
        createFetchStreamHandler(fetchImpl)({ ...request, method }),
      ).resolves.toEqual({
        ok: false,
        error: 'unsupported fetch method',
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it.each(['file:///etc/passwd', 'data:text/plain,test'])(
    'rejects non-HTTP protocol %s',
    async (url) => {
      const fetchImpl = jest.fn();
      await expect(
        createFetchStreamHandler(fetchImpl)({ ...request, url }),
      ).resolves.toEqual({
        ok: false,
        error: 'unsupported fetch protocol',
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it.each(['origin', 'cookie', 'host', 'referer'])(
    'does not relay browser credential header %s',
    async (name) => {
      const fetchImpl = jest.fn();
      await expect(
        createFetchStreamHandler(fetchImpl)({
          ...request,
          headers: [[name, 'private']],
        }),
      ).resolves.toEqual({
        ok: false,
        error: 'unsupported fetch request header',
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('expires an abandoned stream and cancels its reader', async () => {
    jest.useFakeTimers();
    try {
      const cancel = jest.fn();
      const relay = createFetchStreamHandler(
        async () => new Response(new ReadableStream({ cancel })),
        100,
      );
      const opened = await relay(request);
      if (!opened.ok || !('response' in opened))
        throw new OneKeyLocalError('open failed');
      jest.advanceTimersByTime(100);
      expect(cancel).toHaveBeenCalledTimes(1);
      await expect(
        relay({ action: 'read', id: opened.response.id }),
      ).resolves.toEqual({
        ok: false,
        error: 'fetch stream expired or closed',
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('fails a stalled read after the idle limit', async () => {
    jest.useFakeTimers();
    try {
      const relay = createFetchStreamHandler(
        async () => new Response(new ReadableStream()),
        100,
      );
      const opened = await relay(request);
      if (!opened.ok || !('response' in opened))
        throw new OneKeyLocalError('open failed');
      const reading = relay({ action: 'read', id: opened.response.id });
      jest.advanceTimersByTime(100);
      await expect(reading).resolves.toEqual({
        ok: false,
        error: 'fetch stream expired',
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('supports native networking without ReadableStream response bodies', async () => {
    const response = {
      body: null,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    } as Response;
    const relay = createFetchStreamHandler(async () => response);
    const opened = await relay(request);
    if (!opened.ok || !('response' in opened))
      throw new OneKeyLocalError('open failed');
    await expect(
      relay({ action: 'read', id: opened.response.id }),
    ).resolves.toEqual({ ok: true, chunk: { done: false, b64: 'AQID' } });
    await expect(
      relay({ action: 'read', id: opened.response.id }),
    ).resolves.toEqual({ ok: true, chunk: { done: true, b64: '' } });
  });

  it.each([false, true])(
    'bounds each bridge message without losing bytes (buffer fallback: %s)',
    async (fallback) => {
      const bytes = Uint8Array.from(
        { length: FETCH_STREAM_CHUNK_BYTES * 2 + 17 },
        (_, index) => index % 251,
      );
      const response = fallback
        ? ({
            body: null,
            status: 200,
            statusText: 'OK',
            headers: new Headers(),
            arrayBuffer: async () => bytes.buffer,
          } as Response)
        : new Response(bytes);
      const relay = createFetchStreamHandler(async () => response);
      const opened = await relay(request);
      if (!opened.ok || !('response' in opened))
        throw new OneKeyLocalError('open failed');
      const parts: Buffer[] = [];
      for (;;) {
        // eslint-disable-next-line no-await-in-loop
        const reply = await relay({ action: 'read', id: opened.response.id });
        if (!reply.ok || !('chunk' in reply))
          throw new OneKeyLocalError('read failed');
        if (reply.chunk.done) break;
        const part = Buffer.from(reply.chunk.b64, 'base64');
        expect(part.byteLength).toBeLessThanOrEqual(FETCH_STREAM_CHUNK_BYTES);
        parts.push(part);
      }
      expect(parts.map((part) => part.length)).toEqual([
        FETCH_STREAM_CHUNK_BYTES,
        FETCH_STREAM_CHUNK_BYTES,
        17,
      ]);
      expect(new Uint8Array(Buffer.concat(parts))).toEqual(bytes);
    },
  );

  it('rejects oversized declared bodies before reading or encoding', async () => {
    let signal: AbortSignal | null | undefined;
    const relay = createFetchStreamHandler(async (_input, init) => {
      signal = init?.signal;
      return new Response(null, {
        headers: { 'content-length': String(FETCH_RESPONSE_MAX_BYTES + 1) },
      });
    });
    await expect(relay(request)).resolves.toEqual({
      ok: false,
      error: 'fetch response exceeds size limit',
    });
    expect(signal?.aborted).toBe(true);
  });

  it('cancels a lengthless response as soon as it crosses the byte cap', async () => {
    const cancel = jest.fn();
    const relay = createFetchStreamHandler(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(FETCH_RESPONSE_MAX_BYTES + 1));
            },
            cancel,
          }),
        ),
    );
    const opened = await relay(request);
    if (!opened.ok || !('response' in opened))
      throw new OneKeyLocalError('open failed');
    await expect(
      relay({ action: 'read', id: opened.response.id }),
    ).resolves.toEqual({
      ok: false,
      error: 'fetch response exceeds size limit',
    });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('bounds simultaneous streams and releases admission after cancellation', async () => {
    const fetchImpl = jest.fn(async () => new Response('ok'));
    const relay = createFetchStreamHandler(fetchImpl);
    const ids: string[] = [];
    for (let index = 0; index < FETCH_STREAM_MAX_ACTIVE; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      const opened = await relay(request);
      if (!opened.ok || !('response' in opened))
        throw new OneKeyLocalError('open failed');
      ids.push(opened.response.id);
    }
    await expect(relay(request)).resolves.toEqual({
      ok: false,
      error: 'too many active fetch streams',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(FETCH_STREAM_MAX_ACTIVE);
    await relay({ action: 'cancel', id: ids.pop() as string });
    const replacement = await relay(request);
    if (!replacement.ok || !('response' in replacement))
      throw new OneKeyLocalError('open failed');
    ids.push(replacement.response.id);
    await Promise.all(ids.map((id) => relay({ action: 'cancel', id })));
  });
});
