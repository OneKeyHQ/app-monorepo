import {
  allowPrivacyChainRelayProbe,
  clearPrivacyChainRelayTargetsCacheForTest,
  isPrivacyChainRelayTargetAllowed,
} from './privacyChainRelayTargets';

import type { IPrivacyChainRelayTargetSource } from './privacyChainRelayTargets';

jest.mock('../vaults/settings', () => ({ getVaultSettings: jest.fn() }));

const ZCASH = 'zcash--mainnet';
const XMR = 'xmr--mainnet';

function source(
  nodes: Record<string, Array<string | undefined>>,
): IPrivacyChainRelayTargetSource {
  return {
    getLocalWalletNetworkIds: async () => Object.keys(nodes),
    getNodeUrls: async (networkId: string) => nodes[networkId] ?? [],
  };
}

const configured = () =>
  source({
    [ZCASH]: ['https://zcash-mainnet.chainsafe.dev', undefined],
    [XMR]: ['https://xmr-node.example:18089', 'http://192.168.1.5:18081/rpc/'],
  });

function withUserInfo(url: string) {
  const parsed = new URL(url);
  parsed.username = 'user';
  parsed.password = 'secret';
  return parsed.toString();
}

beforeEach(() => clearPrivacyChainRelayTargetsCacheForTest());

describe('privacy-chain relay targets', () => {
  it.each([
    'https://zcash-mainnet.chainsafe.dev/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetLatestBlock',
    'https://ZCASH-mainnet.chainsafe.dev:443/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetTreeState',
    'https://xmr-node.example:18089/json_rpc',
    'https://xmr-node.example:18089/get_blocks.bin',
    'http://192.168.1.5:18081/rpc/get_outs.bin',
  ])('allows a configured node path: %s', async (url) => {
    await expect(
      isPrivacyChainRelayTargetAllowed(url, configured()),
    ).resolves.toBe(true);
  });

  it.each([
    // What a dApp would aim the relay at.
    'http://192.168.1.1/admin',
    'http://127.0.0.1:8080/',
    'https://evil.example/collect',
    // Same host, other scheme / port / path.
    'http://zcash-mainnet.chainsafe.dev/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetLatestBlock',
    'https://xmr-node.example/json_rpc',
    'http://192.168.1.5:18081/other',
    'http://192.168.1.5:18081/rpcx',
    // Lookalikes and smuggling.
    'https://zcash-mainnet.chainsafe.dev.evil.example/',
    withUserInfo('https://xmr-node.example:18089/json_rpc'),
    'file:///etc/passwd',
    'not a url',
  ])('rejects a URL that is not a configured node: %s', async (url) => {
    await expect(
      isPrivacyChainRelayTargetAllowed(url, configured()),
    ).resolves.toBe(false);
  });

  it('sees a node saved after the list was cached', async () => {
    const nodes: Record<string, Array<string | undefined>> = {
      [XMR]: ['https://old.example'],
    };
    const targets = source(nodes);
    await expect(
      isPrivacyChainRelayTargetAllowed('https://old.example/json_rpc', targets),
    ).resolves.toBe(true);
    nodes[XMR] = ['https://new.example'];
    await expect(
      isPrivacyChainRelayTargetAllowed('https://new.example/json_rpc', targets),
    ).resolves.toBe(true);
  });

  it('allows an unsaved node only while it is being probed', async () => {
    const url =
      'https://probe.example/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetLatestBlock';
    const release = allowPrivacyChainRelayProbe('https://probe.example');
    await expect(
      isPrivacyChainRelayTargetAllowed(url, configured()),
    ).resolves.toBe(true);
    release();
    release();
    await expect(
      isPrivacyChainRelayTargetAllowed(url, configured()),
    ).resolves.toBe(false);
  });

  it('keeps an overlapping probe until its last holder releases', async () => {
    const releaseA = allowPrivacyChainRelayProbe('https://probe.example/');
    const releaseB = allowPrivacyChainRelayProbe('https://probe.example');
    releaseA();
    await expect(
      isPrivacyChainRelayTargetAllowed('https://probe.example/x', configured()),
    ).resolves.toBe(true);
    releaseB();
    await expect(
      isPrivacyChainRelayTargetAllowed('https://probe.example/x', configured()),
    ).resolves.toBe(false);
  });
});
