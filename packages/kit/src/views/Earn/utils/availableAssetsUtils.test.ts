import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';

import {
  mergeSimpleEarnWithStakingAssets,
  parseFormattedLiquidityValue,
} from './availableAssetsUtils';

function buildAsset(symbol: string, apr = '1'): IEarnAvailableAsset {
  return {
    name: symbol,
    symbol,
    logoURI: '',
    apr,
    aprWithoutFee: apr,
    tags: [],
    protocols: [],
  } as unknown as IEarnAvailableAsset;
}

describe('availableAssetsUtils', () => {
  it('parses formatted liquidity values and tolerates missing data', () => {
    expect(parseFormattedLiquidityValue('$1.25B')).toBe(1_250_000_000);
    expect(parseFormattedLiquidityValue('850K')).toBe(850_000);
    expect(parseFormattedLiquidityValue(undefined)).toBe(0);
    expect(parseFormattedLiquidityValue('not-a-number')).toBe(0);
  });

  describe('mergeSimpleEarnWithStakingAssets', () => {
    it('keeps native-staking-only symbols that simpleEarn omits (OK-59854)', () => {
      const merged = mergeSimpleEarnWithStakingAssets(
        [buildAsset('USDC'), buildAsset('WETH')],
        [buildAsset('SOL'), buildAsset('ATOM')],
      );
      expect(merged.map((asset) => asset.symbol)).toEqual([
        'USDC',
        'WETH',
        'SOL',
        'ATOM',
      ]);
    });

    it('lets the simpleEarn entry win for a symbol in both categories', () => {
      const merged = mergeSimpleEarnWithStakingAssets(
        [buildAsset('ETH', '3')],
        [buildAsset('ETH', '9'), buildAsset('APT')],
      );
      expect(merged).toHaveLength(2);
      expect(merged[0].symbol).toBe('ETH');
      expect(merged[0].apr).toBe('3');
      expect(merged[1].symbol).toBe('APT');
    });

    it('tolerates either dataset being empty', () => {
      expect(mergeSimpleEarnWithStakingAssets([], [])).toEqual([]);
      expect(
        mergeSimpleEarnWithStakingAssets([], [buildAsset('BTC')]).map(
          (asset) => asset.symbol,
        ),
      ).toEqual(['BTC']);
    });
  });
});
