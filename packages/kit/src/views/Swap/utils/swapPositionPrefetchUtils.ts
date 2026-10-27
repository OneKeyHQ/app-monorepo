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

// The Swap tab stays mounted behind other tabs. Keep only the latest account's
// positions prefetch while hidden, and start it when the surface regains focus.
export function createSwapPositionPrefetchScheduler() {
  let pendingRun: (() => void) | undefined;
  const flush = () => {
    const run = pendingRun;
    pendingRun = undefined;
    run?.();
  };
  return {
    request(run: () => void, isFocused: boolean) {
      pendingRun = run;
      if (isFocused) {
        flush();
      }
    },
    flush,
    cancel() {
      pendingRun = undefined;
    },
  };
}
