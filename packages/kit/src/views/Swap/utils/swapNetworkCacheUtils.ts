import { isNil } from 'lodash';

import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

function hasSwapNetworkSupportFields(network: ISwapNetwork) {
  return (
    (!isNil(network.supportCrossChainSwap) ||
      !isNil(network.supportSingleSwap)) &&
    !isNil(network.supportLimit)
  );
}

export function isSwapNetworkReadyForTokenSelector(network: ISwapNetwork) {
  return (
    hasSwapNetworkSupportFields(network) &&
    typeof network.backendIndex === 'boolean'
  );
}

export function isSwapNetworkCacheCompatible(networks?: ISwapNetwork[] | null) {
  return (
    !!networks?.length && networks.every(isSwapNetworkReadyForTokenSelector)
  );
}

export function isSwapNetworkCacheReadyForBasicList(
  networks?: ISwapNetwork[] | null,
) {
  return (
    !!networks?.length &&
    networks.every(
      (network) =>
        typeof network.networkId === 'string' &&
        network.networkId.length > 0 &&
        hasSwapNetworkSupportFields(network),
    )
  );
}

export function canUseSwapNetworkCacheAsSortSource(
  networks?: ISwapNetwork[] | null,
) {
  return (
    !!networks?.length &&
    networks.every(
      (network) =>
        typeof network.networkId === 'string' && network.networkId.length > 0,
    )
  );
}

export function mergeSwapNetworksWithCachedSort({
  cachedNetworks,
  fetchedNetworks,
}: {
  cachedNetworks?: ISwapNetwork[] | null;
  fetchedNetworks: ISwapNetwork[];
}) {
  if (!cachedNetworks?.length || !fetchedNetworks.length) {
    return fetchedNetworks;
  }

  return cachedNetworks
    .filter((network) =>
      fetchedNetworks.find((item) => item.networkId === network.networkId),
    )
    .map((network) => {
      const fetchedNetwork = fetchedNetworks.find(
        (item) => item.networkId === network.networkId,
      );
      return { ...network, ...fetchedNetwork };
    })
    .concat(
      fetchedNetworks.filter(
        (network) =>
          !cachedNetworks.find((item) => item.networkId === network.networkId),
      ),
    );
}

export function buildSwapNetworkReadyKey(networks: ISwapNetwork[]) {
  return networks
    .map((network) =>
      [
        network.networkId,
        network.supportSingleSwap,
        network.supportCrossChainSwap,
        network.supportLimit,
        network.backendIndex,
      ].join(':'),
    )
    .join('|');
}
