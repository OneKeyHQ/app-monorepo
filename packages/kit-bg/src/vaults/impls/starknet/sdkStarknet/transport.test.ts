import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

import ClientStarknet from './ClientStarknet';
import { JsonRpcTransport } from './JsonRpcTransport';
import { OneKeyTransport } from './OneKeyTransport';

function buildProxyClient() {
  const sendProxyRequest = jest.fn<Promise<string[]>, unknown[]>();
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

  it('propagates proxy failures without a direct RPC fallback', async () => {
    const { client, sendProxyRequest } = buildProxyClient();
    const failure = new Error('proxy unavailable');
    sendProxyRequest.mockRejectedValue(failure);
    await expect(client.getChainId()).rejects.toBe(failure);
    expect(client.rpcUrl).toBe('');
    expect(sendProxyRequest).toHaveBeenCalledTimes(1);
  });
});
