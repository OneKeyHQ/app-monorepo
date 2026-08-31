export function compareSwapProPositionNetworkIds(
  leftNetworkId: string,
  rightNetworkId: string,
) {
  if (leftNetworkId === rightNetworkId) {
    return 0;
  }
  return leftNetworkId < rightNetworkId ? -1 : 1;
}

export function buildSwapProPositionsNetworkIdsKey(networkIds: string[]) {
  return Array.from(new Set(networkIds.filter(Boolean)))
    .toSorted(compareSwapProPositionNetworkIds)
    .join(',');
}
