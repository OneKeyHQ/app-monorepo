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

export const SWAP_POSITION_HIDDEN_PREFETCH_DELAY_MS = 5000;

// The Swap tab stays mounted behind other tabs, so an account switch made
// elsewhere would load positions for every network on top of the refresh that
// switch already causes. While the surface is hidden the latest request waits
// for the account to settle, so a run of switches loads only the last account;
// regaining focus flushes it at once.
export function createSwapPositionPrefetchScheduler(
  delayMs = SWAP_POSITION_HIDDEN_PREFETCH_DELAY_MS,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingRun: (() => void) | undefined;
  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };
  const flush = () => {
    clearTimer();
    const run = pendingRun;
    pendingRun = undefined;
    run?.();
  };
  return {
    request(run: () => void, isFocused: boolean) {
      clearTimer();
      pendingRun = run;
      if (isFocused) {
        flush();
        return;
      }
      timer = setTimeout(flush, delayMs);
    },
    flush,
    cancel() {
      clearTimer();
      pendingRun = undefined;
    },
  };
}
