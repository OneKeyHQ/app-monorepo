import type { IMarketBasicConfigNetwork } from '@onekeyhq/shared/types/marketV2';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

export type ISwapPositionPrefetchScope = {
  key: 'swap' | 'stock' | 'pro';
  networkList: (IMarketBasicConfigNetwork | ISwapNetwork)[];
  stockOnly: boolean;
};

export function buildSwapPositionPrefetchScopes({
  swapNetworksReady,
  proNetworksReady,
  swapNetworkList,
  stockNetworkList,
  proNetworkList,
}: {
  swapNetworksReady: boolean;
  proNetworksReady: boolean;
  swapNetworkList: ISwapNetwork[];
  stockNetworkList: ISwapNetwork[];
  proNetworkList: IMarketBasicConfigNetwork[];
}): ISwapPositionPrefetchScope[] {
  const scopes: ISwapPositionPrefetchScope[] = [
    {
      key: 'swap',
      networkList: swapNetworkList,
      stockOnly: false,
    },
    {
      key: 'stock',
      networkList: stockNetworkList,
      stockOnly: true,
    },
    {
      key: 'pro',
      networkList: proNetworkList,
      stockOnly: false,
    },
  ];
  return scopes.filter(
    (scope) =>
      (scope.key === 'pro' ? proNetworksReady : swapNetworksReady) &&
      scope.networkList.length > 0,
  );
}
