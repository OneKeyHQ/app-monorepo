import { hostFetchStream as desktopHost } from './hostFetchStream.desktop';
import { hostFetchStream as nativeHost } from './hostFetchStream.web-embed';

import type { IFetchStreamRequest } from '../../types/fetchStream';

describe('host fetch stream platform channels', () => {
  const request: IFetchStreamRequest = {
    action: 'open',
    method: 'POST',
    url: 'https://node.example',
    headers: [['x-grpc-web', '1']],
    b64: 'AAAAAAA=',
  };
  const globals = globalThis as unknown as {
    desktopApi?: Pick<typeof globalThis.desktopApi, 'fetchStream'>;
    $onekey?: { $private?: { request: (params: unknown) => Promise<unknown> } };
  };
  const saved = { desktopApi: globals.desktopApi, $onekey: globals.$onekey };
  afterEach(() => {
    Object.assign(globals, saved);
  });

  it('uses the desktop IPC stream without falling back if the shell lacks it', async () => {
    const stream = jest.fn(async () => ({
      ok: true as const,
      cancelled: true as const,
    }));
    globals.desktopApi = { fetchStream: stream };
    await expect(desktopHost(request)).resolves.toEqual({
      ok: true,
      cancelled: true,
    });
    expect(stream).toHaveBeenCalledWith(request);
    globals.desktopApi = undefined;
    await expect(desktopHost(request)).rejects.toThrow(
      'desktop fetch stream channel unavailable',
    );
  });

  it('uses the mobile private bridge with JSON-safe request parameters', async () => {
    const bridge = jest.fn(async () => ({
      ok: true,
      chunk: { done: false, b64: 'AQID' },
    }));
    globals.$onekey = { $private: { request: bridge } };
    await expect(nativeHost(request)).resolves.toEqual({
      ok: true,
      chunk: { done: false, b64: 'AQID' },
    });
    expect(bridge).toHaveBeenCalledWith({
      method: 'fetchStream',
      params: request,
    });
    globals.$onekey = undefined;
    await expect(nativeHost(request)).rejects.toThrow(
      'native fetch stream channel unavailable',
    );
  });

  it('preserves node failures from the mobile host', async () => {
    globals.$onekey = {
      $private: {
        request: jest.fn(async () => ({ ok: false, error: 'node TLS error' })),
      },
    };
    await expect(nativeHost(request)).resolves.toEqual({
      ok: false,
      error: 'node TLS error',
    });
  });
});
