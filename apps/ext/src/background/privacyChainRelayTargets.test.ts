import appGlobals from '@onekeyhq/shared/src/appGlobals';

import { backgroundPrivacyChainRelayTargets } from './privacyChainRelayTargets';

jest.mock('@onekeyhq/kit-bg/src/vaults/settings', () => ({
  getVaultSettings: async () => ({ builtInRpcUrls: ['https://node.example'] }),
}));

describe('extension relay targets', () => {
  const saved = {
    proxy: appGlobals.$backgroundApiProxy,
    backgroundApi: appGlobals.$$backgroundApi,
  };

  afterEach(() => {
    appGlobals.$backgroundApiProxy = saved.proxy;
    appGlobals.$$backgroundApi = saved.backgroundApi;
  });

  // Production builds never assign $$backgroundApi.
  it('reads the background API from the proxy', async () => {
    appGlobals.$$backgroundApi = undefined as never;
    appGlobals.$backgroundApiProxy = {
      backgroundApi: {
        servicePrivacyChain: {
          getLocalWalletNetworkIds: async () => ['zec--0'],
        },
        serviceCustomRpc: {
          resolveRpcUrlWithBuiltIn: async () => 'https://active.example',
          getCustomRpcForNetwork: async () => undefined,
        },
      },
    } as unknown as typeof appGlobals.$backgroundApiProxy;

    await expect(
      backgroundPrivacyChainRelayTargets.getLocalWalletNetworkIds(),
    ).resolves.toEqual(['zec--0']);
    await expect(
      backgroundPrivacyChainRelayTargets.getNodeUrls('zec--0'),
    ).resolves.toEqual([
      'https://node.example',
      'https://active.example',
      undefined,
    ]);
  });

  it('fails clearly before the background API exists', async () => {
    appGlobals.$backgroundApiProxy = {
      backgroundApi: null,
    } as unknown as typeof appGlobals.$backgroundApiProxy;

    expect(() =>
      backgroundPrivacyChainRelayTargets.getLocalWalletNetworkIds(),
    ).toThrow('Background API is not ready');
  });
});
