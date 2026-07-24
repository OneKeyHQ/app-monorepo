import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';

import {
  filterAndSortAvailableAssets,
  getAvailableAssetNetworkData,
  parseFormattedLiquidityValue,
} from './availableAssetsUtils';

function buildAsset({
  symbol,
  apr,
  liquidity,
  networkIds,
}: {
  symbol: string;
  apr: string;
  liquidity?: string;
  networkIds: string[];
}): IEarnAvailableAsset {
  return {
    name: symbol,
    symbol,
    logoURI: '',
    apr,
    aprWithoutFee: apr,
    tags: [],
    rewardUnit: 'APY',
    liquidity,
    protocols: networkIds.map((networkId) => ({
      networkId,
      provider: `${symbol}-${networkId}`,
    })),
  };
}

describe('availableAssetsUtils', () => {
  const assets = [
    buildAsset({
      symbol: 'USDT',
      apr: '3.5%',
      liquidity: '$1.2M',
      networkIds: ['evm--1', 'evm--56'],
    }),
    buildAsset({
      symbol: 'USDC',
      apr: '5.25%',
      liquidity: '$850K',
      networkIds: ['evm--1'],
    }),
    buildAsset({
      symbol: 'DAI',
      apr: '1%',
      liquidity: '$2.1M',
      networkIds: ['evm--137'],
    }),
  ];

  it('counts each asset once per network', () => {
    expect(getAvailableAssetNetworkData(assets)).toEqual({
      availableNetworkIds: ['evm--1', 'evm--56', 'evm--137'],
      networkAssetCounts: {
        'evm--1': 2,
        'evm--56': 1,
        'evm--137': 1,
      },
    });
  });

  it('filters by any selected network and sorts yield high to low', () => {
    expect(
      filterAndSortAvailableAssets({
        assets,
        selectedNetworkIds: ['evm--1'],
        sortKey: 'yield',
      }).map((asset) => asset.symbol),
    ).toEqual(['USDC', 'USDT']);
  });

  it('sorts formatted liquidity high to low', () => {
    expect(
      filterAndSortAvailableAssets({
        assets,
        selectedNetworkIds: [],
        sortKey: 'liquidity',
      }).map((asset) => asset.symbol),
    ).toEqual(['DAI', 'USDT', 'USDC']);
  });

  it('parses formatted liquidity values and tolerates missing data', () => {
    expect(parseFormattedLiquidityValue('$1.25B')).toBe(1_250_000_000);
    expect(parseFormattedLiquidityValue('850K')).toBe(850_000);
    expect(parseFormattedLiquidityValue(undefined)).toBe(0);
    expect(parseFormattedLiquidityValue('not-a-number')).toBe(0);
  });
});
