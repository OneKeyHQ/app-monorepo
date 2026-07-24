import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';

export type IEarnAvailableAssetSortKey = 'yield' | 'liquidity';

const liquidityUnitMultiplierMap: Record<string, number> = {
  k: 10 ** 3,
  m: 10 ** 6,
  b: 10 ** 9,
  t: 10 ** 12,
};

export function parseFormattedLiquidityValue(value?: string): number {
  if (!value) {
    return 0;
  }

  const match = value.replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)([kmbt])?/i);
  if (!match) {
    return 0;
  }

  const parsedValue = Number(match[1]);
  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  const unit = match[2]?.toLowerCase();
  const multiplier = unit ? (liquidityUnitMultiplierMap[unit] ?? 1) : 1;

  return parsedValue * multiplier;
}

export function getAvailableAssetNetworkData(assets: IEarnAvailableAsset[]) {
  const networkAssetCounts: Record<string, number> = {};

  for (const asset of assets) {
    const assetNetworkIds = new Set(
      asset.protocols.map((protocol) => protocol.networkId).filter(Boolean),
    );
    for (const networkId of assetNetworkIds) {
      networkAssetCounts[networkId] = (networkAssetCounts[networkId] ?? 0) + 1;
    }
  }

  return {
    availableNetworkIds: Object.keys(networkAssetCounts),
    networkAssetCounts,
  };
}

export function filterAndSortAvailableAssets({
  assets,
  selectedNetworkIds,
  sortKey,
}: {
  assets: IEarnAvailableAsset[];
  selectedNetworkIds: string[];
  sortKey: IEarnAvailableAssetSortKey;
}) {
  const selectedNetworkIdSet = new Set(selectedNetworkIds);
  const filteredAssets =
    selectedNetworkIdSet.size === 0
      ? assets
      : assets.filter((asset) =>
          asset.protocols.some((protocol) =>
            selectedNetworkIdSet.has(protocol.networkId),
          ),
        );

  return filteredAssets.toSorted((assetA, assetB) => {
    if (sortKey === 'liquidity') {
      return (
        parseFormattedLiquidityValue(assetB.liquidity) -
        parseFormattedLiquidityValue(assetA.liquidity)
      );
    }

    const aprA = Number.parseFloat(assetA.aprWithoutFee || assetA.apr || '0');
    const aprB = Number.parseFloat(assetB.aprWithoutFee || assetB.apr || '0');
    return (
      (Number.isFinite(aprB) ? aprB : 0) - (Number.isFinite(aprA) ? aprA : 0)
    );
  });
}
