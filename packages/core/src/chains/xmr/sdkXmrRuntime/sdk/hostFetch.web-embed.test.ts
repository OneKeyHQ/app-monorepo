import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { xmrHostFetch } from './hostFetch.web-embed';

type IGlobal = { $onekey?: unknown; fetch: typeof fetch };

describe('xmr web-embed node relay', () => {
  const g = globalThis as unknown as IGlobal;
  const realFetch = g.fetch;
  afterEach(() => {
    g.fetch = realFetch;
    delete g.$onekey;
  });

  function withChannel(request: jest.Mock) {
    g.$onekey = { $private: { request } };
  }

  it('relays through the app and decodes the reply', async () => {
    const request = jest.fn(async () => ({
      ok: true,
      b64: bufferUtils.bytesToBase64(new Uint8Array([7, 8])),
    }));
    withChannel(request);
    const bytes = await xmrHostFetch(
      'http://node.example:18081/json_rpc',
      'application/json',
      new Uint8Array([1]),
    );
    expect(Array.from(bytes)).toEqual([7, 8]);
    expect(request).toHaveBeenCalledWith({
      method: 'privacyChainNodeRequest',
      params: {
        url: 'http://node.example:18081/json_rpc',
        contentType: 'application/json',
        b64: bufferUtils.bytesToBase64(new Uint8Array([1])),
      },
    });
  });

  // An older app without the relay must keep working as it did.
  it("falls back to the page's fetch when the channel is unavailable", async () => {
    withChannel(jest.fn().mockRejectedValue(new Error('method not found')));
    g.fetch = jest.fn(
      async () => new Response(new Uint8Array([5])),
    ) as unknown as typeof fetch;
    const bytes = await xmrHostFetch(
      'https://node.example/json_rpc',
      'application/json',
      new Uint8Array(),
    );
    expect(Array.from(bytes)).toEqual([5]);
  });

  it("reports the node's failure instead of retrying elsewhere", async () => {
    withChannel(jest.fn(async () => ({ ok: false, error: 'node down' })));
    g.fetch = jest.fn() as unknown as typeof fetch;
    await expect(
      xmrHostFetch(
        'https://node.example/json_rpc',
        'application/json',
        new Uint8Array(),
      ),
    ).rejects.toThrow('node down');
    expect(g.fetch).not.toHaveBeenCalled();
  });
});
