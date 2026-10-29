/* eslint-disable import/first */

const mockHostFetch = jest.fn<
  Promise<Uint8Array>,
  [string, string, Uint8Array]
>();

jest.mock('../../../dbs/local/localDbInstance');
jest.mock('@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/sdk/hostFetch', () => ({
  xmrHostFetch: (url: string, contentType: string, body: Uint8Array) =>
    mockHostFetch(url, contentType, body),
}));

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import Vault from './Vault';

const NODE = 'https://xmr.example';
const MAINNET_GENESIS =
  '418015bb9ae982a1975da7d79277c2705727a56894ba0fb246adaabb1f4632e3';
const TESTNET_GENESIS =
  '48ca7cd3c8de5b6a4d53d2861fbdaedca141553559f9be9520068053cda8430b';

function serveNode(genesisReply: unknown) {
  mockHostFetch.mockImplementation(async (url, _contentType, body) => {
    if (url === `${NODE}/get_height`) {
      return bufferUtils.utf8ToBytes(JSON.stringify({ height: 3_500_000 }));
    }
    if (url === `${NODE}/json_rpc`) {
      const request = JSON.parse(bufferUtils.bytesToUtf8(body)) as {
        method: string;
        params: number[];
      };
      expect(request).toMatchObject({
        method: 'on_get_block_hash',
        params: [0],
      });
      if (genesisReply instanceof Error) throw genesisReply;
      return bufferUtils.utf8ToBytes(JSON.stringify(genesisReply));
    }
    throw new OneKeyLocalError(`unexpected request ${url}`);
  });
}

function createVault() {
  return Object.assign(Object.create(Vault.prototype) as Vault, {
    networkId: 'xmr--0',
    getXmrNetwork: async () => 'mainnet' as const,
  });
}

describe('xmr node status chain check', () => {
  afterEach(() => {
    mockHostFetch.mockReset();
  });

  it('accepts a node whose genesis block is mainnet', async () => {
    serveNode({ result: MAINNET_GENESIS });

    await expect(
      createVault().getCustomRpcEndpointStatus({
        rpcUrl: NODE,
        validateChainId: true,
      }),
    ).resolves.toMatchObject({ bestBlockNumber: 3_500_000 });
  });

  it.each([
    ['another network', { result: TESTNET_GENESIS }, 'different network'],
    ['an unknown genesis', { result: 'ab'.repeat(32) }, 'did not confirm'],
    ['no genesis', { error: { code: -32_601 } }, 'did not confirm'],
    ['a failed request', new Error('502'), 'did not confirm'],
  ])('refuses a node that reports %s', async (_label, reply, message) => {
    serveNode(reply);

    await expect(
      createVault().getCustomRpcEndpointStatus({
        rpcUrl: NODE,
        validateChainId: true,
      }),
    ).rejects.toThrow(message);
  });

  it('does not ask for the chain when no check is requested', async () => {
    serveNode(new Error('not asked'));

    await expect(
      createVault().getCustomRpcEndpointStatus({
        rpcUrl: NODE,
        validateChainId: false,
      }),
    ).resolves.toMatchObject({ bestBlockNumber: 3_500_000 });
    expect(mockHostFetch).toHaveBeenCalledTimes(1);
  });
});
