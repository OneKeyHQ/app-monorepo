import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

export function resolveDefaultSelectedNetworkIds({
  homeNetworkId,
  initialSelectedNetworkIds,
  supportedNetworkIds,
  enabledNetworkIds,
}: {
  homeNetworkId?: string;
  initialSelectedNetworkIds?: string[];
  supportedNetworkIds: string[];
  // Networks still turned on in All Networks. Omit to skip that filter.
  enabledNetworkIds?: string[];
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

  // Automatic defaults stay inside networks the All Networks view still
  // shows. A missing list means that filter is not available yet.
  const enabledSet = enabledNetworkIds ? new Set(enabledNetworkIds) : undefined;
  const candidates = enabledSet
    ? supportedNetworkIds.filter((networkId) => enabledSet.has(networkId))
    : supportedNetworkIds;

  // All-networks home has no single current network. Default to ETH when it
  // is still enabled, so a casual export does not include every network or
  // one the user turned off.
  if (networkUtils.isAllNetwork({ networkId: homeNetworkId })) {
    if (candidates.includes(networkIdsMap.eth)) {
      return [networkIdsMap.eth];
    }
    return candidates[0] ? [candidates[0]] : [];
  }

  if (homeNetworkId && supportedNetworkIds.includes(homeNetworkId)) {
    return [homeNetworkId];
  }

  if (candidates.includes(networkIdsMap.eth)) {
    return [networkIdsMap.eth];
  }

  return candidates[0] ? [candidates[0]] : [];
}
