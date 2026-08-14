import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { parseFormattedLiquidityValue } from './availableAssetsUtils';

export type IEarnProtocolSortKey = 'tvl' | 'yield';
export type IEarnProtocolSortDirection = 'asc' | 'desc';

function parseProtocolMetric(value?: string | null) {
  if (!value || !/\d/.test(value)) {
    return undefined;
  }
  const parsed = parseFormattedLiquidityValue(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getProtocolMetric(
  item: IStakeProtocolListItem,
  sortKey: IEarnProtocolSortKey,
) {
  if (sortKey === 'tvl') {
    return parseProtocolMetric(
      item.provider.totalFiatValue || item.provider.tvl || item.tvl?.text,
    );
  }
  return parseProtocolMetric(item.provider.aprWithoutFee);
}

export function getProtocolNetworkData(items: IStakeProtocolListItem[]) {
  const networkAssetCounts: Record<string, number> = {};
  for (const item of items) {
    const networkId = item.network.networkId;
    if (networkId) {
      networkAssetCounts[networkId] = (networkAssetCounts[networkId] ?? 0) + 1;
    }
  }
  return {
    availableNetworkIds: Object.keys(networkAssetCounts),
    networkAssetCounts,
  };
}

export function filterAndSortProtocols({
  items,
  selectedNetworkIds,
  sortKey,
  sortDirection,
}: {
  items: IStakeProtocolListItem[];
  selectedNetworkIds: string[];
  sortKey: IEarnProtocolSortKey;
  sortDirection: IEarnProtocolSortDirection;
}) {
  const selectedNetworkIdSet = new Set(selectedNetworkIds);
  const filteredItems =
    selectedNetworkIdSet.size === 0
      ? items
      : items.filter((item) =>
          selectedNetworkIdSet.has(item.network.networkId),
        );

  return filteredItems.toSorted((itemA, itemB) => {
    const valueA = getProtocolMetric(itemA, sortKey);
    const valueB = getProtocolMetric(itemB, sortKey);
    if (valueA === undefined && valueB === undefined) {
      return 0;
    }
    if (valueA === undefined) {
      return 1;
    }
    if (valueB === undefined) {
      return -1;
    }
    return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
  });
}
