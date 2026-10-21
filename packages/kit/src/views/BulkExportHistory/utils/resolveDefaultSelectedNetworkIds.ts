import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

export function resolveDefaultSelectedNetworkIds({
  homeNetworkId,
  initialSelectedNetworkIds,
  supportedNetworkIds,
}: {
  homeNetworkId?: string;
  initialSelectedNetworkIds?: string[];
  supportedNetworkIds: string[];
}) {
  const networkIdsMap = getNetworkIdsMap();

  if (!supportedNetworkIds.length) {
    return [];
  }

  if (initialSelectedNetworkIds?.length) {
    const supportedSet = new Set(supportedNetworkIds);
    const matched = Array.from(new Set(initialSelectedNetworkIds)).filter(
      (networkId) => supportedSet.has(networkId),
    );
    if (matched.length > 0) {
      return matched;
    }
  }

  // All-networks home has no single current network. Default to ETH so a
  // casual export does not include every enabled network.
  if (networkUtils.isAllNetwork({ networkId: homeNetworkId })) {
    if (supportedNetworkIds.includes(networkIdsMap.eth)) {
      return [networkIdsMap.eth];
    }
    return [supportedNetworkIds[0]];
  }

  if (homeNetworkId && supportedNetworkIds.includes(homeNetworkId)) {
    return [homeNetworkId];
  }

  if (supportedNetworkIds.includes(networkIdsMap.eth)) {
    return [networkIdsMap.eth];
  }

  return [supportedNetworkIds[0]];
}
