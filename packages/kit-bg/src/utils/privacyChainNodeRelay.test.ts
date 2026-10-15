import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { relayPrivacyChainNodeRequest } from './privacyChainNodeRelay';

describe('privacy-chain node relay', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('refuses anything but http(s)', async () => {
    await expect(
      relayPrivacyChainNodeRequest({
        url: 'file:///etc/passwd',
        contentType: 'application/json',
        body: new Uint8Array(),
      }),
    ).resolves.toEqual({ ok: false, error: 'unsupported protocol file:' });
  });

  it('returns the node bytes as base64', async () => {
    globalThis.fetch = jest.fn(
      async () => new Response(new Uint8Array([1, 2, 3])),
    ) as unknown as typeof fetch;
    const result = await relayPrivacyChainNodeRequest({
      url: 'http://node.example:18081/get_blocks.bin',
      contentType: 'application/octet-stream',
      body: new Uint8Array([9]),
    });
    expect(result).toEqual({
      ok: true,
      b64: bufferUtils.bytesToBase64(new Uint8Array([1, 2, 3])),
    });
  });

  it('reports a node error with its status', async () => {
    globalThis.fetch = jest.fn(
      async () => new Response('', { status: 503, statusText: 'Busy' }),
    ) as unknown as typeof fetch;
    await expect(
      relayPrivacyChainNodeRequest({
        url: 'https://node.example/json_rpc',
        contentType: 'application/json',
        body: new Uint8Array(),
      }),
    ).resolves.toEqual({ ok: false, error: 'node answered HTTP 503 Busy' });
  });
});
