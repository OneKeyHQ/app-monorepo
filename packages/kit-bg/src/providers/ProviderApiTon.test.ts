import ProviderApiTon from './ProviderApiTon';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  providerApiMethod: () => () => undefined,
  permissionRequired: () => () => undefined,
}));
jest.mock('../vaults/factory', () => ({ vaultFactory: {} }));
jest.mock('../vaults/impls/ton/sdkTon/utils', () => ({}));
jest.mock('./ProviderApiBase', () => ({
  __esModule: true,
  default: class {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

function setup(accounts: unknown = null) {
  const serviceDApp = {
    dAppGetConnectedAccountsInfo: jest.fn().mockResolvedValue(accounts),
    openConnectionModal: jest.fn(),
  };
  const provider = new ProviderApiTon({ backgroundApi: { serviceDApp } });
  const response = { address: 'authorized-address' };
  const getResponse = jest.fn().mockResolvedValue(response);
  Object.defineProperty(provider, '_getAccountResponse', {
    value: getResponse,
  });
  const request = (params: unknown): IJsBridgeMessagePayload =>
    ({
      origin: 'https://dapp.example',
      scope: 'ton',
      data: { method: 'connect', params },
    }) as IJsBridgeMessagePayload;
  return { provider, serviceDApp, request, response, getResponse };
}

describe('TON connection restoration', () => {
  it('returns only an existing TON authorization without opening a modal', async () => {
    const account = { id: 'account' };
    const { provider, serviceDApp, request, response, getResponse } = setup([
      { account, accountInfo: { networkId: 'ton-network' } },
    ]);
    await expect(provider.restoreConnection(request([]))).resolves.toEqual(
      response,
    );
    expect(serviceDApp.dAppGetConnectedAccountsInfo).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'https://dapp.example', scope: 'ton' }),
    );
    expect(getResponse).toHaveBeenCalledWith(account, 'ton-network');
    expect(serviceDApp.openConnectionModal).not.toHaveBeenCalled();
  });

  it('returns null for an unapproved origin without requesting authorization', async () => {
    const { provider, serviceDApp, request, getResponse } = setup();
    await expect(provider.restoreConnection(request([]))).resolves.toBeNull();
    expect(getResponse).not.toHaveBeenCalled();
    expect(serviceDApp.openConnectionModal).not.toHaveBeenCalled();
  });

  it('still validates the manifest origin for an explicit connect request', async () => {
    const { provider, request, serviceDApp } = setup();
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ name: 'Example', url: 'https://different.example' }),
    } as Response);
    globalThis.fetch = fetchMock;
    try {
      await expect(
        provider.connect(
          request([2, { manifestUrl: 'https://dapp.example/manifest.json' }]),
          [],
        ),
      ).rejects.toMatchObject({ code: 3 });
      expect(fetchMock).toHaveBeenCalledWith(
        'https://dapp.example/manifest.json',
      );
      expect(serviceDApp.openConnectionModal).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it.each([
    undefined,
    {},
    [],
    [2],
    [2, null],
    [2, {}],
    [2, { manifestUrl: 123 }],
  ])(
    'rejects malformed connect parameters without a TypeError: %j',
    async (params) => {
      const { provider, request, serviceDApp } = setup();
      await expect(provider.connect(request(params), [])).rejects.toMatchObject(
        { code: 2 },
      );
      expect(serviceDApp.openConnectionModal).not.toHaveBeenCalled();
    },
  );
});
