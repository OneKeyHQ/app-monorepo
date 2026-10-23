import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  getSwapTokenSearchContractNetworkId,
  normalizeSwapTokenSearchNetworks,
} from '@onekeyhq/shared/src/utils/swapTokenSearchRequestUtils';
import type { IFetchTokensParams } from '@onekeyhq/shared/types/swap/types';

export const SWAP_TOKEN_SELECTOR_DESKTOP_CACHE_SIZE = 100;

export type ISwapTokenSelectorLoadOptions = {
  policy?: 'snapshot' | 'revalidate';
  background?: boolean;
  throwOnError?: boolean;
};

// These versions invalidate every Swap store, including selectors that were
// closed when a transaction settled or the wallet's derivation changed.
let cacheEpoch = { refresh: 0, identity: 0 };
const listeners = new Set<() => void>();

function invalidate(identityChanged: boolean) {
  cacheEpoch = {
    refresh: cacheEpoch.refresh + 1,
    identity: cacheEpoch.identity + (identityChanged ? 1 : 0),
  };
  listeners.forEach((listener) => listener());
}

appEventBus.on(EAppEventBusNames.SwapTxHistoryStatusUpdate, () =>
  invalidate(false),
);
appEventBus.on(EAppEventBusNames.HistoryTxStatusChanged, () =>
  invalidate(false),
);
appEventBus.on(EAppEventBusNames.GlobalDeriveTypeUpdate, () =>
  invalidate(true),
);
appEventBus.on(EAppEventBusNames.WalletClear, () => invalidate(true));

export function getSwapTokenSelectorCacheEpoch() {
  return cacheEpoch;
}

export function subscribeSwapTokenSelectorCache(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function buildSwapTokenListCacheKey(params: IFetchTokensParams) {
  // Control flags (prefetch, cancellation and error handling) do not change
  // the result. Keep every query/account/filter dimension in a stable order.
  return JSON.stringify({
    protocol: params.protocol,
    networkId: params.networkId,
    contractSearchNetworkId: getSwapTokenSearchContractNetworkId(params),
    searchNetworks: params.searchNetworks
      ? normalizeSwapTokenSearchNetworks(params.searchNetworks)
      : undefined,
    keywords: params.keywords ?? '',
    limit: params.limit ?? 50,
    accountAddress: params.accountAddress,
    accountNetworkId: params.accountNetworkId,
    accountId: params.accountId,
    onlyAccountTokens: params.onlyAccountTokens,
    onlySwapTokens: params.onlySwapTokens,
    lpToken: params.lpToken,
    currency: params.currency,
  });
}

export function isSwapTokenSelectorSnapshotCurrent(entry?: {
  refreshVersion?: number;
  identityVersion?: number;
}) {
  return (
    entry !== undefined &&
    entry.refreshVersion === cacheEpoch.refresh &&
    entry.identityVersion === cacheEpoch.identity
  );
}
