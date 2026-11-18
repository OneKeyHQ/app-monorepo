import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import BackgroundApiBase from './BackgroundApiBase';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

jest.mock('./TravelModeDappRequestIngress', () => ({
  travelModeDappRequestIngress: {
    run: <T>({ operation }: { operation: () => Promise<T> }) => operation(),
  },
}));

const walletConnectContext = {
  walletConnectTopic: 'approved-session-topic',
  walletConnectDisplayOrigin: 'https://app.uniswap.org',
  walletConnectVerifyContext: {
    verified: { origin: 'https://app.uniswap.org', validation: 'VALID' },
  },
  wcChainName: 'eip155:1',
};

function buildBackgroundApi() {
  const backgroundApi = Object.create(
    BackgroundApiBase.prototype,
  ) as BackgroundApiBase;
  const handleMethods = jest.fn<Promise<unknown[]>, [IJsBridgeMessagePayload]>(
    async () => [],
  );
  Object.defineProperty(backgroundApi, 'getProviderApi', {
    value: jest.fn(async () => ({ handleMethods })),
  });
  return { backgroundApi, handleMethods };
}

describe('WalletConnect context on provider requests', () => {
  it('drops the WalletConnect context a web page sends', async () => {
    const { backgroundApi, handleMethods } = buildBackgroundApi();

    await backgroundApi._bridgeReceiveHandler({
      id: 1,
      origin: 'https://dapp.example',
      scope: IInjectedProviderNames.ethereum,
      isWalletConnectRequest: true,
      data: {
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_accounts',
        params: [],
        ...walletConnectContext,
      },
    });

    expect(handleMethods).toHaveBeenCalledWith({
      id: 1,
      origin: 'https://dapp.example',
      scope: IInjectedProviderNames.ethereum,
      data: { id: 1, jsonrpc: '2.0', method: 'eth_accounts', params: [] },
    });
  });

  it('passes other web page requests through as is', async () => {
    const { backgroundApi, handleMethods } = buildBackgroundApi();
    const request: IJsBridgeMessagePayload = {
      id: 2,
      origin: 'https://dapp.example',
      scope: IInjectedProviderNames.ethereum,
      data: { id: 2, jsonrpc: '2.0', method: 'eth_chainId' },
    };

    await backgroundApi._bridgeReceiveHandler(request);

    expect(handleMethods.mock.calls[0][0]).toBe(request);
  });

  it('keeps the context the WalletConnect request proxy attaches', async () => {
    const { backgroundApi, handleMethods } = buildBackgroundApi();
    const request: IJsBridgeMessagePayload = {
      origin: 'https://app.uniswap.org',
      scope: IInjectedProviderNames.ethereum,
      isWalletConnectRequest: true,
      data: { method: 'eth_accounts', ...walletConnectContext },
    };

    await backgroundApi.handleProviderMethods(request);

    expect(handleMethods.mock.calls[0][0]).toBe(request);
  });
});
