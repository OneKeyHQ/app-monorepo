import type { IServerNetwork } from '@onekeyhq/shared/types';

import ProviderApiTron from './ProviderApiTron';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  providerApiMethod: () => () => undefined,
  permissionRequired: () => () => undefined,
}));
jest.mock('./ProviderApiBase', () => ({
  __esModule: true,
  default: class {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

function setup({
  networks = [],
  accountsInfo = [],
}: {
  networks?: Array<Pick<IServerNetwork, 'id' | 'chainId' | 'isTestnet'>>;
  accountsInfo?: Array<{ account?: { address: string } }>;
} = {}) {
  const serviceDApp = {
    getConnectedNetworks: jest.fn().mockResolvedValue(networks),
    dAppGetConnectedAccountsInfo: jest.fn().mockResolvedValue(accountsInfo),
  };
  const provider = new ProviderApiTron({ backgroundApi: { serviceDApp } });
  const request = (method: string): IJsBridgeMessagePayload =>
    ({
      origin: 'https://dapp.example',
      scope: 'tron',
      data: { method },
    }) as IJsBridgeMessagePayload;

  return { provider, serviceDApp, request };
}

describe('ProviderApiTron network and chainId resolution', () => {
  it('returns Nile node URL for preset Tron Nile Testnet with prefixed chainId', async () => {
    const { provider, request } = setup({
      networks: [
        {
          id: 'tron--0xcd8690dc',
          chainId: 'tron--0xcd8690dc',
          isTestnet: true,
        },
      ],
    });

    await expect(provider.tron_nodes(request('tron_nodes'))).resolves.toEqual({
      fullHost: 'https://nile.trongrid.io',
      fullNode: 'https://nile.trongrid.io',
      solidityNode: 'https://nile.trongrid.io',
      eventServer: 'https://nile.trongrid.io',
    });
  });

  it('returns Nile node URL for Nile network with plain hex chainId', async () => {
    const { provider, request } = setup({
      networks: [
        {
          id: 'tron--0xcd8690dc',
          chainId: '0xcd8690dc',
          isTestnet: true,
        },
      ],
    });

    await expect(provider.tron_nodes(request('tron_nodes'))).resolves.toEqual({
      fullHost: 'https://nile.trongrid.io',
      fullNode: 'https://nile.trongrid.io',
      solidityNode: 'https://nile.trongrid.io',
      eventServer: 'https://nile.trongrid.io',
    });
  });

  it('returns Shasta node URL for Shasta network', async () => {
    const { provider, request } = setup({
      networks: [
        {
          id: 'tron--0x94a9059e',
          chainId: '0x94a9059e',
          isTestnet: true,
        },
      ],
    });

    await expect(provider.tron_nodes(request('tron_nodes'))).resolves.toEqual({
      fullHost: 'https://api.shasta.trongrid.io',
      fullNode: 'https://api.shasta.trongrid.io',
      solidityNode: 'https://api.shasta.trongrid.io',
      eventServer: 'https://api.shasta.trongrid.io',
    });
  });

  it('falls back to Shasta node URL for unknown testnet without hex chainId', async () => {
    const { provider, request } = setup({
      networks: [
        {
          id: 'tron--custom-testnet',
          chainId: 'custom-testnet',
          isTestnet: true,
        },
      ],
    });

    await expect(provider.tron_nodes(request('tron_nodes'))).resolves.toEqual({
      fullHost: 'https://api.shasta.trongrid.io',
      fullNode: 'https://api.shasta.trongrid.io',
      solidityNode: 'https://api.shasta.trongrid.io',
      eventServer: 'https://api.shasta.trongrid.io',
    });
  });

  it('returns Mainnet node URL for Mainnet and when no network is connected', async () => {
    const mainnetSetup = setup({
      networks: [
        {
          id: 'tron--0x2b6653dc',
          chainId: '0x2b6653dc',
          isTestnet: false,
        },
      ],
    });
    await expect(
      mainnetSetup.provider.tron_nodes(mainnetSetup.request('tron_nodes')),
    ).resolves.toEqual({
      fullHost: 'https://api.trongrid.io',
      fullNode: 'https://api.trongrid.io',
      solidityNode: 'https://api.trongrid.io',
      eventServer: 'https://api.trongrid.io',
    });

    const emptySetup = setup({ networks: [] });
    await expect(
      emptySetup.provider.tron_nodes(emptySetup.request('tron_nodes')),
    ).resolves.toEqual({
      fullHost: 'https://api.trongrid.io',
      fullNode: 'https://api.trongrid.io',
      solidityNode: 'https://api.trongrid.io',
      eventServer: 'https://api.trongrid.io',
    });
  });

  it.each([
    {
      name: 'Nile with prefixed chainId',
      network: {
        id: 'tron--0xcd8690dc',
        chainId: 'tron--0xcd8690dc',
        isTestnet: true,
      },
      expected: '0xcd8690dc',
    },
    {
      name: 'Nile falling back from chainId 0 to network id',
      network: {
        id: 'tron--0xcd8690dc',
        chainId: '0',
        isTestnet: true,
      },
      expected: '0xcd8690dc',
    },
    {
      name: 'Mainnet',
      network: {
        id: 'tron--0x2b6653dc',
        chainId: '0x2b6653dc',
        isTestnet: false,
      },
      expected: '0x2b6653dc',
    },
    {
      name: 'Shasta',
      network: {
        id: 'tron--0x94a9059e',
        chainId: '0x94a9059e',
        isTestnet: true,
      },
      expected: '0x94a9059e',
    },
  ])(
    'resolves tron_chainId and eth_chainId for $name',
    async ({ network, expected }) => {
      const { provider, request } = setup({ networks: [network] });

      await expect(
        provider.tron_chainId(request('tron_chainId')),
      ).resolves.toBe(expected);
      await expect(provider.eth_chainId(request('eth_chainId'))).resolves.toBe(
        expected,
      );
    },
  );

  it('returns undefined chainId when no network is connected or chainId cannot be parsed', async () => {
    const emptySetup = setup({ networks: [] });
    await expect(
      emptySetup.provider.tron_chainId(emptySetup.request('tron_chainId')),
    ).resolves.toBeUndefined();
    await expect(
      emptySetup.provider.eth_chainId(emptySetup.request('eth_chainId')),
    ).resolves.toBeUndefined();

    const invalidSetup = setup({
      networks: [
        {
          id: 'tron--custom-testnet',
          chainId: 'custom-testnet',
          isTestnet: true,
        },
      ],
    });
    await expect(
      invalidSetup.provider.tron_chainId(invalidSetup.request('tron_chainId')),
    ).resolves.toBeUndefined();
  });

  it('returns Nile nodes with connected accounts in tron_getProviderState', async () => {
    const { provider, request } = setup({
      networks: [
        {
          id: 'tron--0xcd8690dc',
          chainId: 'tron--0xcd8690dc',
          isTestnet: true,
        },
      ],
      accountsInfo: [
        { account: { address: 'TV9tkfhtLHMyLvU5Lsr3WMvp4AoKFxmgn3' } },
      ],
    });

    await expect(
      provider.tron_getProviderState(request('tron_getProviderState')),
    ).resolves.toEqual({
      accounts: ['TV9tkfhtLHMyLvU5Lsr3WMvp4AoKFxmgn3'],
      nodes: {
        fullHost: 'https://nile.trongrid.io',
        fullNode: 'https://nile.trongrid.io',
        solidityNode: 'https://nile.trongrid.io',
        eventServer: 'https://nile.trongrid.io',
      },
    });
  });
});
