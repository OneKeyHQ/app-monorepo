import { createPrivacyChainFetchStreamRelay } from './privacyChainNodeRelay';
import { clearPrivacyChainRelayTargetsCacheForTest } from './privacyChainRelayTargets';

import type { IPrivacyChainRelayTargetSource } from './privacyChainRelayTargets';

jest.mock('../vaults/settings', () => ({ getVaultSettings: jest.fn() }));

const ZCASH_NODE = 'https://zcash-mainnet.chainsafe.dev';
const XMR_NODE = 'http://node.example:18081';

const targets: IPrivacyChainRelayTargetSource = {
  getLocalWalletNetworkIds: async () => ['zcash--mainnet', 'xmr--mainnet'],
  getNodeUrls: async (networkId) =>
    networkId === 'zcash--mainnet' ? [ZCASH_NODE] : [XMR_NODE],
};

function withUserInfo(url: string) {
  const parsed = new URL(url);
  parsed.username = 'user';
  parsed.password = 'secret';
  return parsed.toString();
}

beforeEach(() => clearPrivacyChainRelayTargetsCacheForTest());

describe('privacy-chain fetch stream relay', () => {
  const closeStream = async (
    relay: ReturnType<typeof createPrivacyChainFetchStreamRelay>,
    result: Awaited<
      ReturnType<ReturnType<typeof createPrivacyChainFetchStreamRelay>>
    >,
  ) => {
    if (result.ok && 'response' in result) {
      await relay({ action: 'cancel', id: result.response.id });
    }
  };

  const open = (url: string, method = 'POST') => ({
    action: 'open' as const,
    url,
    method,
    headers: [] as [string, string][],
    b64: method === 'POST' ? '' : undefined,
  });

  it('opens a Zcash gRPC-web stream to the configured node', async () => {
    const fetchImpl = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response('ok'),
    );
    const relay = createPrivacyChainFetchStreamRelay(targets, fetchImpl);
    const url = `${ZCASH_NODE}/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetLatestBlock`;
    const result = await relay(open(url));
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        response: expect.objectContaining({ status: 200 }),
      }),
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      url,
      expect.objectContaining({ credentials: 'omit', redirect: 'error' }),
    );
    await closeStream(relay, result);
  });

  it('opens an XMR stream to the configured node', async () => {
    const fetchImpl = jest.fn(async () => new Response('ok'));
    const relay = createPrivacyChainFetchStreamRelay(targets, fetchImpl);
    const result = await relay(open(`${XMR_NODE}/get_blocks.bin`));
    expect(result).toEqual(expect.objectContaining({ ok: true }));
    await closeStream(relay, result);
  });

  it('opens the normalized URL it checked', async () => {
    const fetchImpl = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response('ok'),
    );
    const relay = createPrivacyChainFetchStreamRelay(targets, fetchImpl);
    const result = await relay(
      open('HTTPS://Zcash-Mainnet.chainsafe.dev:443/x/../GetLatestBlock'),
    );
    expect(fetchImpl.mock.calls[0][0]).toBe(`${ZCASH_NODE}/GetLatestBlock`);
    await closeStream(relay, result);
  });

  it('answers with an error when the node list cannot be read', async () => {
    const fetchImpl = jest.fn();
    const relay = createPrivacyChainFetchStreamRelay(
      {
        getLocalWalletNetworkIds: async () => {
          throw new TypeError('background not ready');
        },
        getNodeUrls: async () => [],
      },
      fetchImpl,
    );
    await expect(relay(open(`${XMR_NODE}/json_rpc`))).resolves.toEqual({
      ok: false,
      error: 'background not ready',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ['an arbitrary LAN host', open('http://192.168.1.1/')],
    ['a non-http scheme', open('file:///etc/passwd')],
    ['URL credentials', open(withUserInfo(`${XMR_NODE}/json_rpc`))],
    ['a GET to a configured node', open(`${XMR_NODE}/get_info`, 'GET')],
  ])('rejects %s before any request', async (_label, request) => {
    const fetchImpl = jest.fn();
    const relay = createPrivacyChainFetchStreamRelay(targets, fetchImpl);
    await expect(relay(request)).resolves.toEqual(
      expect.objectContaining({ ok: false }),
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
