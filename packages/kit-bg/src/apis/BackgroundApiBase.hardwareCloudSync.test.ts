import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { buildHardwareCloudSyncMessage } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';

import BackgroundApiBase from './BackgroundApiBase';

jest.mock('./TravelModeDappRequestIngress', () => ({
  travelModeDappRequestIngress: {
    run: <T>({ operation }: { operation: () => T | Promise<T> }) => operation(),
  },
}));

describe('Cloud key provider ingress protection', () => {
  test.each([
    { scope: IInjectedProviderNames.ethereum, isWalletConnectRequest: false },
    { scope: IInjectedProviderNames.btc, isWalletConnectRequest: false },
    { scope: IInjectedProviderNames.solana, isWalletConnectRequest: false },
    { scope: IInjectedProviderNames.btc, isWalletConnectRequest: true },
  ])(
    'rejects $scope, WalletConnect=$isWalletConnectRequest before loading a provider',
    async ({ scope, isWalletConnectRequest }) => {
      const backgroundApi = Object.create(
        BackgroundApiBase.prototype,
      ) as BackgroundApiBase;
      const getProviderApi = jest.fn();
      Object.defineProperty(backgroundApi, 'getProviderApi', {
        value: getProviderApi,
      });

      await expect(
        backgroundApi.handleProviderMethods({
          data: {
            id: 1,
            jsonrpc: '2.0',
            method: 'signMessage',
            params: [
              {
                message: buildHardwareCloudSyncMessage('0123456789abcdef'),
                walletInternalSign: true,
              },
            ],
          },
          origin: 'https://app.onekey.so',
          scope,
          isWalletConnectRequest,
        }),
      ).rejects.toThrow('OneKey Cloud key operations');
      expect(getProviderApi).not.toHaveBeenCalled();
    },
  );

  test('continues ordinary provider dispatch', async () => {
    const backgroundApi = Object.create(
      BackgroundApiBase.prototype,
    ) as BackgroundApiBase;
    const handleMethods = jest.fn(async () => ['0x1234']);
    Object.defineProperty(backgroundApi, 'getProviderApi', {
      value: jest.fn(async () => ({ handleMethods })),
    });
    await expect(
      backgroundApi.handleProviderMethods({
        data: { id: 2, jsonrpc: '2.0', method: 'eth_accounts', params: [] },
        origin: 'https://example.com',
        scope: IInjectedProviderNames.ethereum,
      }),
    ).resolves.toMatchObject({ id: 2, result: ['0x1234'] });
    expect(handleMethods).toHaveBeenCalledTimes(1);
  });
});
