// cspell:ignore stagenet
import { privacyChainNodeFetch } from '@onekeyhq/core/src/utils/privacyChainNodeFetch';

import {
  XMR_MAINNET_GENESIS_HASH,
  XMR_STAGENET_GENESIS_HASH,
  XMR_TESTNET_GENESIS_HASH,
  fetchXmrNodeHeightDirect,
  probeXmrNodeNetworkDirect,
  xmrNetworkFromGenesisHash,
} from './xmrNodeDirect';

jest.mock('@onekeyhq/core/src/utils/privacyChainNodeFetch', () => ({
  privacyChainNodeFetch: jest.fn(),
}));

const nodeFetch = jest.mocked(privacyChainNodeFetch);

describe('xmrNodeDirect', () => {
  beforeEach(() => {
    nodeFetch.mockReset();
  });

  it.each([
    [XMR_MAINNET_GENESIS_HASH, 'mainnet'],
    [XMR_MAINNET_GENESIS_HASH.toUpperCase(), 'mainnet'],
    [XMR_TESTNET_GENESIS_HASH, 'testnet'],
    [XMR_STAGENET_GENESIS_HASH, 'stagenet'],
  ])('maps genesis %s to %s', (hash, network) => {
    expect(xmrNetworkFromGenesisHash(hash)).toBe(network);
  });

  it('returns null height when the node does not answer', async () => {
    nodeFetch.mockResolvedValue(new Response('', { status: 503 }));
    await expect(
      fetchXmrNodeHeightDirect({ nodeBase: 'https://node.example' }),
    ).resolves.toBeNull();
  });

  // An unread error body would hold a desktop host stream until it idles out.
  it('cancels the request once an error status is read', async () => {
    nodeFetch.mockResolvedValue(new Response('busy', { status: 429 }));
    await fetchXmrNodeHeightDirect({ nodeBase: 'https://node.example' });
    expect(nodeFetch.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it('gives up on a node that never answers', async () => {
    jest.useFakeTimers();
    try {
      nodeFetch.mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new Error('aborted')),
            );
          }),
      );
      const outcome = fetchXmrNodeHeightDirect({
        nodeBase: 'https://node.example',
      }).then(
        () => 'answered',
        (error: unknown) => (error instanceof Error ? error.message : ''),
      );
      await jest.advanceTimersByTimeAsync(10_000);
      await expect(outcome).resolves.toBe('aborted');
    } finally {
      jest.useRealTimers();
    }
  });

  // `/get_height` counts blocks; the runtime's tip is the top block's number.
  it('reads the top block number from get_height', async () => {
    nodeFetch.mockResolvedValue(
      new Response(JSON.stringify({ height: 3_512_327 }), { status: 200 }),
    );
    await expect(
      fetchXmrNodeHeightDirect({ nodeBase: 'https://node.example/' }),
    ).resolves.toBe(3_512_326);
    expect(nodeFetch).toHaveBeenCalledWith(
      'https://node.example/get_height',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('probes network via genesis block hash', async () => {
    nodeFetch.mockResolvedValue(
      new Response(JSON.stringify({ result: XMR_MAINNET_GENESIS_HASH }), {
        status: 200,
      }),
    );
    await expect(
      probeXmrNodeNetworkDirect({ nodeBase: 'https://node.example' }),
    ).resolves.toBe('mainnet');
  });
});
