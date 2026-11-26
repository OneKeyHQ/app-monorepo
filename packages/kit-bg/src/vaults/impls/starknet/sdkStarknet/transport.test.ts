import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

import ClientStarknet from './ClientStarknet';
import { JsonRpcTransport } from './JsonRpcTransport';
import { OneKeyTransport } from './OneKeyTransport';

function buildProxyClient() {
  const sendProxyRequest = jest.fn<Promise<unknown[]>, unknown[]>();
  const backgroundApi = {
    serviceAccountProfile: { sendProxyRequest },
  } as unknown as IBackgroundApi;
  return {
    client: new ClientStarknet({
      networkId: 'starknet--mainnet',
      backgroundApi,
    }),
    sendProxyRequest,
  };
}

describe('ClientStarknet transport selection', () => {
  it('distinguishes incomplete contract results from zero', async () => {
    const { client } = buildProxyClient();
    const response = jest.spyOn(client, 'callContract').mockResolvedValue([]);
    await expect(client.getPoolFeeAmount('0x1')).rejects.toThrow();
    await expect(
      client.getTokenBalance({ tokenAddress: '0x2', accountAddress: '0x1' }),
    ).rejects.toThrow();
    await expect(client.getTokenDecimals('0x2')).rejects.toThrow();
    await expect(client.isPoolPaused('0x2')).rejects.toThrow();
    response.mockResolvedValue(['0x0']);
    await expect(
      client.getTokenBalance({ tokenAddress: '0x2', accountAddress: '0x1' }),
    ).rejects.toThrow();
    await expect(client.getPoolFeeAmount('0x1')).resolves.toBe('0');
    await expect(client.getTokenDecimals('0x2')).resolves.toBe(0);
    await expect(client.isPoolPaused('0x2')).resolves.toBe(false);
    response.mockResolvedValue(['0x3e73362871420000']);
    await expect(client.getPoolFeeAmount('0x1')).resolves.toBe(
      '4500000000000000000',
    );
    response.mockResolvedValue([' ']);
    await expect(client.getPoolFeeAmount('0x1')).rejects.toThrow();
    await expect(client.getTokenDecimals('0x2')).rejects.toThrow();
    response.mockResolvedValue(['0x1', '0x100000000000000000000000000000000']);
    await expect(
      client.getTokenBalance({ tokenAddress: '0x2', accountAddress: '0x1' }),
    ).rejects.toThrow();
    response.mockResolvedValue(['0x0', '0x0']);
    await expect(client.getPoolFeeAmount('0x1')).resolves.toBe('0');
  });

  it('goes direct to a custom RPC url when one is configured', () => {
    const client = new ClientStarknet({
      networkId: 'starknet--mainnet',
      customRpcUrl: 'https://my-node.example/rpc/v0_9',
    });
    expect(client.transport).toBeInstanceOf(JsonRpcTransport);
    expect(client.rpcUrl).toBe('https://my-node.example/rpc/v0_9');
  });

  it('uses the url verbatim rather than appending a spec path', () => {
    const client = new ClientStarknet({
      networkId: 'starknet--mainnet',
      customRpcUrl: 'https://my-node.example',
    });
    expect(client.rpcUrl).toBe('https://my-node.example');
  });

  it('uses the wallet proxy by default and exposes no direct RPC URL', () => {
    const { client } = buildProxyClient();
    expect(client.transport).toBeInstanceOf(OneKeyTransport);
    expect(client.rpcUrl).toBe('');
  });

  it('refuses default RPC without a backgroundApi', () => {
    expect(
      () => new ClientStarknet({ networkId: 'starknet--mainnet' }),
    ).toThrow(/requires a backgroundApi/);
  });

  it('keeps proof nonce reads on the proxy at latest', async () => {
    const { client, sendProxyRequest } = buildProxyClient();
    sendProxyRequest.mockResolvedValue(['0x7']);
    await expect(client.getNonce('0x1234', 'latest')).resolves.toBe('0x7');
    expect(sendProxyRequest).toHaveBeenCalledTimes(1);
    expect(sendProxyRequest).toHaveBeenCalledWith({
      networkId: 'starknet--mainnet',
      isJsonRpc: true,
      body: [
        {
          route: 'rpc',
          params: { method: 'starknet_getNonce', params: ['latest', '0x1234'] },
        },
      ],
    });
  });

  it('shares one lookup per block and keeps missing timestamps unknown', async () => {
    const { client, sendProxyRequest } = buildProxyClient();
    sendProxyRequest.mockResolvedValueOnce([{ timestamp: 1_780_000_000 }]);
    const times = await Promise.all([
      client.getBlockTimestamp(100),
      client.getBlockTimestamp(100),
    ]);
    expect(times).toEqual([1_780_000_000, 1_780_000_000]);
    expect(sendProxyRequest).toHaveBeenCalledTimes(1);
    expect(sendProxyRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        body: [
          {
            route: 'rpc',
            params: {
              method: 'starknet_getBlockWithTxHashes',
              params: [{ block_number: 100 }],
            },
          },
        ],
      }),
    );
    sendProxyRequest.mockRejectedValueOnce(new Error('Method not allowed'));
    await expect(client.getBlockTimestamp(101)).resolves.toBeUndefined();
  });

  it('propagates proxy failures without a direct RPC fallback', async () => {
    const { client, sendProxyRequest } = buildProxyClient();
    const failure = new Error('proxy unavailable');
    sendProxyRequest.mockRejectedValue(failure);
    await expect(client.getChainId()).rejects.toBe(failure);
    expect(client.rpcUrl).toBe('');
    expect(sendProxyRequest).toHaveBeenCalledTimes(1);
  });
});
