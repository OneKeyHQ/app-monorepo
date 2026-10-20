import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import {
  createPrivacyChainFetchStreamRelay,
  relayPrivacyChainNodeRequest,
} from './privacyChainNodeRelay';
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

describe('privacy-chain node relay', () => {
  it('refuses anything but http(s)', async () => {
    const fetchImpl = jest.fn();
    await expect(
      relayPrivacyChainNodeRequest({
        url: 'file:///etc/passwd',
        contentType: 'application/json',
        body: new Uint8Array(),
        targets,
        fetchImpl,
      }),
    ).resolves.toEqual({ ok: false, error: 'unsupported protocol file:' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses URL credentials', async () => {
    const fetchImpl = jest.fn();
    await expect(
      relayPrivacyChainNodeRequest({
        url: withUserInfo(`${XMR_NODE}/json_rpc`),
        contentType: 'application/json',
        body: new Uint8Array(),
        targets,
        fetchImpl,
      }),
    ).resolves.toEqual({
      ok: false,
      error: 'URL credentials are not supported',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses a host that is not a configured node, before any request', async () => {
    const fetchImpl = jest.fn();
    await expect(
      relayPrivacyChainNodeRequest({
        url: 'http://192.168.1.1/cgi-bin/admin',
        contentType: 'application/json',
        body: new Uint8Array([1]),
        targets,
        fetchImpl,
      }),
    ).resolves.toEqual({
      ok: false,
      error: 'not a configured privacy-chain node',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts to a configured XMR node without credentials or redirects', async () => {
    const fetchImpl = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(new Uint8Array([1, 2, 3])),
    );
    const result = await relayPrivacyChainNodeRequest({
      url: `${XMR_NODE}/get_blocks.bin`,
      contentType: 'application/octet-stream',
      body: new Uint8Array([9]),
      targets,
      fetchImpl,
    });
    expect(result).toEqual({
      ok: true,
      b64: bufferUtils.bytesToBase64(new Uint8Array([1, 2, 3])),
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      `${XMR_NODE}/get_blocks.bin`,
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        redirect: 'error',
      }),
    );
  });

  it('reports a node error with its status', async () => {
    const fetchImpl = jest.fn(
      async () => new Response('', { status: 503, statusText: 'Busy' }),
    );
    await expect(
      relayPrivacyChainNodeRequest({
        url: `${XMR_NODE}/json_rpc`,
        contentType: 'application/json',
        body: new Uint8Array(),
        targets,
        fetchImpl,
      }),
    ).resolves.toEqual({ ok: false, error: 'node answered HTTP 503 Busy' });
  });
});

describe('privacy-chain fetch stream relay', () => {
  // Opened streams keep an idle timer; close them like the client does.
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

  it.each([
    ['an arbitrary LAN host', open('http://192.168.1.1/')],
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
