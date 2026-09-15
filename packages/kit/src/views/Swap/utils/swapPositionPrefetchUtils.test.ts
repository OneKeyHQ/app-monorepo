import type { IMarketBasicConfigNetwork } from '@onekeyhq/shared/types/marketV2';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import { buildSwapPositionPrefetchScopes } from './swapPositionPrefetchUtils';

const swapNetwork: ISwapNetwork = {
  networkId: 'evm--1',
  name: 'Ethereum',
  symbol: 'ETH',
};
const stockNetwork: ISwapNetwork = {
  networkId: 'evm--8453',
  name: 'Base',
  symbol: 'ETH',
};
const proNetwork: IMarketBasicConfigNetwork = {
  networkId: 'evm--42161',
  index: 0,
  name: 'Arbitrum',
  logoUrl: '',
  explorerUrl: '',
  chainId: '42161',
};

describe('buildSwapPositionPrefetchScopes', () => {
  it('starts Pro independently when Swap networks are not ready', () => {
    expect(
      buildSwapPositionPrefetchScopes({
        swapNetworksReady: false,
        proNetworksReady: true,
        swapNetworkList: [swapNetwork],
        stockNetworkList: [stockNetwork],
        proNetworkList: [proNetwork],
      }),
    ).toEqual([{ key: 'pro', networkList: [proNetwork], stockOnly: false }]);
  });

  it('does not block Swap and Stock on slow or failed Pro configuration', () => {
    expect(
      buildSwapPositionPrefetchScopes({
        swapNetworksReady: true,
        proNetworksReady: false,
        swapNetworkList: [swapNetwork],
        stockNetworkList: [stockNetwork],
        proNetworkList: [],
      }),
    ).toEqual([
      { key: 'swap', networkList: [swapNetwork], stockOnly: false },
      { key: 'stock', networkList: [stockNetwork], stockOnly: true },
    ]);
  });

  it('does not start either source before it is ready', () => {
    expect(
      buildSwapPositionPrefetchScopes({
        swapNetworksReady: false,
        proNetworksReady: false,
        swapNetworkList: [swapNetwork],
        stockNetworkList: [stockNetwork],
        proNetworkList: [proNetwork],
      }),
    ).toEqual([]);
  });

  it('uses one stable tab-independent scope order', () => {
    const scopes = buildSwapPositionPrefetchScopes({
      swapNetworksReady: true,
      proNetworksReady: true,
      swapNetworkList: [swapNetwork],
      stockNetworkList: [stockNetwork],
      proNetworkList: [proNetwork],
    });

    expect(scopes.map((scope) => scope.key)).toEqual(['swap', 'stock', 'pro']);
    expect(scopes.map((scope) => scope.stockOnly)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('omits unsupported empty scopes without reordering the others', () => {
    const scopes = buildSwapPositionPrefetchScopes({
      swapNetworksReady: true,
      proNetworksReady: true,
      swapNetworkList: [swapNetwork],
      stockNetworkList: [],
      proNetworkList: [proNetwork],
    });

    expect(scopes.map((scope) => scope.key)).toEqual(['swap', 'pro']);
  });
});
