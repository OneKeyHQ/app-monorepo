import { streamingFetch } from '@onekeyhq/shared/src/utils/streamingFetch';

import { privacyChainNodeRequest } from './privacyChainNodeFetch';

jest.mock('@onekeyhq/shared/src/utils/hostFetchStream', () => ({
  hostFetchStream: undefined,
}));
jest.mock('@onekeyhq/shared/src/utils/streamingFetch', () => ({
  streamingFetch: jest.fn(),
}));

const platformFetch = jest.mocked(streamingFetch);
const MiB = 1024 * 1024;

describe('privacyChainNodeRequest without a host relay', () => {
  beforeEach(() => {
    platformFetch.mockReset();
  });

  it('sends no cookies and refuses redirects, as the relay does', async () => {
    platformFetch.mockResolvedValue(new Response('{}'));
    await privacyChainNodeRequest('https://node.example/get_height', {
      method: 'POST',
      body: '{}',
    });
    expect(platformFetch).toHaveBeenCalledWith(
      'https://node.example/get_height',
      expect.objectContaining({
        method: 'POST',
        body: '{}',
        credentials: 'omit',
        redirect: 'error',
      }),
    );
  });

  it('returns the status, headers and body bytes', async () => {
    platformFetch.mockResolvedValue(
      new Response('{"height":3}', { headers: { 'grpc-status': '0' } }),
    );
    const reply = await privacyChainNodeRequest('https://node.example', {});
    expect(reply.ok).toBe(true);
    expect(reply.headers?.get('grpc-status')).toBe('0');
    expect(new TextDecoder().decode(reply.bytes)).toBe('{"height":3}');
  });

  it('keeps an error status without reading the body', async () => {
    platformFetch.mockResolvedValue(new Response('busy', { status: 503 }));
    const reply = await privacyChainNodeRequest('https://node.example', {});
    expect(reply.ok).toBe(false);
    expect(reply.status).toBe(503);
    expect(reply.bytes.byteLength).toBe(0);
  });

  // A bad node can stream 33 MiB without declaring a length.
  it('refuses a reply over the relay cap', async () => {
    const chunk = new Uint8Array(MiB);
    let sent = 0;
    platformFetch.mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          pull(controller) {
            if (sent === 33) {
              controller.close();
              return;
            }
            sent += 1;
            controller.enqueue(chunk);
          },
        }),
      ),
    );
    await expect(
      privacyChainNodeRequest('https://node.example', {}),
    ).rejects.toThrow('node response exceeds size limit');
  });
});
