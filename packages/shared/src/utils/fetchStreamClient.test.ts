import { OneKeyLocalError } from '../errors';

import { createFetchStreamHandler } from './fetchStream';
import { createFetchStream } from './fetchStreamClient';

import type {
  IFetchStreamRequest,
  IFetchStreamResult,
} from '../../types/fetchStream';

describe('streaming host fetch', () => {
  const url = 'https://node.example/proxy/GetBlockRange';
  const init = {
    method: 'POST',
    headers: {
      'content-type': 'application/grpc-web+proto',
      'x-grpc-web': '1',
    },
    body: new Uint8Array([0, 0, 0, 0, 0]),
  };

  it('streams an ordinary GET download without adding a request body', async () => {
    const fetchImpl = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { 'content-type': 'application/octet-stream' },
        }),
    );
    const relay = jest.fn(createFetchStreamHandler(fetchImpl));
    const response = await createFetchStream(relay)(
      'https://example.test/download?part=1',
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/download?part=1',
      expect.objectContaining({
        method: 'GET',
        body: undefined,
        credentials: 'omit',
      }),
    );
    expect(relay.mock.calls[0][0]).toMatchObject({
      action: 'open',
      method: 'GET',
    });
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])(
    'preserves %s and binary request bytes through the shared bridge',
    async (method) => {
      const fetchImpl = jest.fn(
        async (_input: RequestInfo | URL, _init?: RequestInit) =>
          new Response('received'),
      );
      const response = await createFetchStream(
        createFetchStreamHandler(fetchImpl),
      )('https://example.test/resource', {
        method,
        body: new Uint8Array([0, 255, 128]),
      });
      await expect(response.text()).resolves.toBe('received');
      expect(fetchImpl).toHaveBeenCalledWith(
        'https://example.test/resource',
        expect.objectContaining({
          method,
          body: new Uint8Array([0, 255, 128]),
        }),
      );
    },
  );

  it('returns HEAD metadata without reading a body or retaining a host stream', async () => {
    const relay = jest.fn(
      createFetchStreamHandler(
        async () =>
          new Response(null, {
            headers: {
              'content-length': String(512 * 1024 * 1024),
              etag: 'download-v1',
            },
          }),
      ),
    );
    const response = await createFetchStream(relay)(
      'https://example.test/download',
      { method: 'HEAD' },
    );
    expect(response.body).toBeNull();
    expect(response.headers.get('etag')).toBe('download-v1');
    expect(relay.mock.calls.map(([request]) => request.action)).toEqual([
      'open',
      'cancel',
    ]);
    const opened = relay.mock.results[0];
    const reply = await opened.value;
    if (!reply.ok || !('response' in reply))
      throw new OneKeyLocalError('open failed');
    await expect(
      relay({ action: 'read', id: reply.response.id }),
    ).resolves.toEqual({
      ok: false,
      error: 'fetch stream expired or closed',
    });
  });

  it('delivers the first chunk before EOF and preserves headers, status and trailers', async () => {
    let upstream: ReadableStreamDefaultController<Uint8Array> | undefined;
    const fetchImpl = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              upstream = controller;
              controller.enqueue(new Uint8Array([0, 0, 0, 0, 1, 8]));
            },
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/grpc-web+proto',
              'grpc-status': '0',
            },
          },
        ),
    );
    const relay = createFetchStreamHandler(fetchImpl);
    const response = await createFetchStream(relay)(url, init);
    expect(response.status).toBe(200);
    expect(response.headers.get('grpc-status')).toBe('0');
    expect(response.headers.get('content-type')).toBe(
      'application/grpc-web+proto',
    );
    const reader = response.body?.getReader();
    await expect(reader?.read()).resolves.toEqual({
      done: false,
      value: new Uint8Array([0, 0, 0, 0, 1, 8]),
    });
    // This includes the gRPC-web trailer marker; transport must not strip it.
    const trailer = new Uint8Array([128, 0, 0, 0, 2, 13, 10]);
    upstream?.enqueue(trailer);
    upstream?.close();
    await expect(reader?.read()).resolves.toEqual({
      done: false,
      value: trailer,
    });
    await expect(reader?.read()).resolves.toEqual({
      done: true,
      value: undefined,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        body: init.body,
      }),
    );
    const requestInit = fetchImpl.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(new Headers(requestInit?.headers).get('x-grpc-web')).toBe('1');
    expect(new Headers(requestInit?.headers).has('origin')).toBe(false);
  });

  it('removes HTTP hop-by-hop headers before sending grpc-web through Electron', async () => {
    const fetchImpl = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(''),
    );
    const response = await createFetchStream(
      createFetchStreamHandler(fetchImpl),
    )(url, {
      ...init,
      headers: { ...init.headers, te: 'trailers', 'content-length': '999' },
    });
    await response.arrayBuffer();
    const headers = new Headers(fetchImpl.mock.calls[0]?.[1]?.headers);
    expect(headers.has('te')).toBe(false);
    expect(headers.has('content-length')).toBe(false);
    expect(headers.get('x-grpc-web')).toBe('1');
  });

  it('preserves HTTP errors and header-only gRPC NOT_FOUND', async () => {
    const relay = createFetchStreamHandler(
      async () =>
        new Response('', {
          status: 503,
          statusText: 'Busy',
          headers: { 'grpc-status': '5' },
        }),
    );
    const response = await createFetchStream(relay)(url, init);
    expect(response.ok).toBe(false);
    expect(response.status).toBe(503);
    expect(response.headers.get('grpc-status')).toBe('5');
    await response.arrayBuffer();
  });

  it('cancels the host stream when the consumer aborts, without a second route', async () => {
    const cancel = jest.fn();
    const fetchImpl = jest.fn(
      async () => new Response(new ReadableStream<Uint8Array>({ cancel })),
    );
    const relay = jest.fn(createFetchStreamHandler(fetchImpl));
    const controller = new AbortController();
    const response = await createFetchStream(relay)(url, {
      ...init,
      signal: controller.signal,
    });
    const reading = response.arrayBuffer();
    controller.abort();
    await expect(reading).rejects.toThrow('aborted');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(
      relay.mock.calls.some(([request]) => request.action === 'cancel'),
    ).toBe(true);
  });

  it('propagates a transport error without falling back to page fetch', async () => {
    const error = new Error('TLS handshake failed');
    const fetchImpl = jest.fn(async () => {
      throw error;
    });
    await expect(
      createFetchStream(createFetchStreamHandler(fetchImpl))(url, init),
    ).rejects.toThrow('TLS handshake failed');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('aborts before headers arrive and releases the eventual host handle', async () => {
    let release: ((result: IFetchStreamResult) => void) | undefined;
    let opened: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      opened = resolve;
    });
    const requester = jest.fn(
      async (request: IFetchStreamRequest): Promise<IFetchStreamResult> => {
        if (request.action !== 'open') return { ok: true, cancelled: true };
        opened?.();
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    );
    const controller = new AbortController();
    const pending = createFetchStream(requester)(url, {
      ...init,
      signal: controller.signal,
    });
    await started;
    controller.abort();
    await expect(pending).rejects.toThrow('aborted');
    release?.({
      ok: true,
      response: {
        id: 'late-stream',
        status: 200,
        statusText: 'OK',
        headers: [],
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(requester).toHaveBeenLastCalledWith({
      action: 'cancel',
      id: 'late-stream',
    });
  });

  it('preserves responses that must not have a body and closes their host handle', async () => {
    const relay = jest.fn(
      createFetchStreamHandler(
        async () =>
          new Response(null, { status: 204, headers: { 'grpc-status': '5' } }),
      ),
    );
    const response = await createFetchStream(relay)(url, init);
    expect(response.status).toBe(204);
    expect(response.headers.get('grpc-status')).toBe('5');
    expect(response.body).toBeNull();
    expect(
      relay.mock.calls.some(([request]) => request.action === 'cancel'),
    ).toBe(true);
  });
});
