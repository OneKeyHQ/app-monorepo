import ClientStarknet from './ClientStarknet';
import { STARKNET_DEFAULT_RPC_URLS } from './consts';
import { JsonRpcTransport } from './JsonRpcTransport';

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

  it('falls back to the bundled default while the proxy is disabled', () => {
    for (const networkId of Object.keys(STARKNET_DEFAULT_RPC_URLS)) {
      const client = new ClientStarknet({ networkId });
      expect(client.transport).toBeInstanceOf(JsonRpcTransport);
      expect(client.rpcUrl).toBe(STARKNET_DEFAULT_RPC_URLS[networkId]);
    }
  });

  it('refuses a network with no bundled default and no custom url', () => {
    expect(
      () => new ClientStarknet({ networkId: 'starknet--nowhere' }),
    ).toThrow(/No Starknet RPC url configured/);
  });

  describe('when the backend proxy is enabled', () => {
    beforeEach(() => {
      jest.resetModules();
      jest.doMock('./consts', () => ({
        ...(jest.requireActual('./consts') as Record<string, unknown>),
        STARKNET_BACKEND_PROXY_ENABLED: true,
      }));
    });

    afterEach(() => {
      jest.dontMock('./consts');
      jest.resetModules();
    });

    it('routes through OneKeyTransport and reports no rpc url', async () => {
      const { default: ProxyClient } = await import('./ClientStarknet');
      const { OneKeyTransport } = await import('./OneKeyTransport');
      const client = new ProxyClient({
        networkId: 'starknet--mainnet',
        backgroundApi: {} as never,
      });
      expect(client.transport).toBeInstanceOf(OneKeyTransport);
      expect(client.rpcUrl).toBe('');
    });

    it('refuses to build a proxy transport without a backgroundApi', async () => {
      const { default: ProxyClient } = await import('./ClientStarknet');
      expect(() => new ProxyClient({ networkId: 'starknet--mainnet' })).toThrow(
        /requires a backgroundApi/,
      );
    });
  });
});
