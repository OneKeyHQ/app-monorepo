import BigNumber from 'bignumber.js';

import { buildMockCatalog } from '@onekeyhq/kit-bg/src/services/ServicePools/poolsMockBuilder';
import type { IPool } from '@onekeyhq/shared/types/pools';

import {
  formatCompactTokenAmount,
  formatPriceChange,
  formatTokenAmountShort,
  formatTokenPrice,
  getPoolPair,
  sortByPair,
} from './poolsFormat';

const catalog = buildMockCatalog(1_760_000_000_000);

function poolOf(seedKey: string): IPool {
  const pool = catalog.pools.find(
    (item) => item.id === catalog.poolIdBySeedKey[seedKey],
  );
  expect(pool).toBeDefined();
  return pool as IPool;
}

describe('pools format', () => {
  it('lists pool-order tokens the way the pair reads', () => {
    // USDC is token0 here, but the pair reads WETH / USDC
    const pool = poolOf('eth-v3-usdc-weth-500');
    const { base } = getPoolPair(pool);
    expect(base.id).toBe(pool.token1.id);
    const items = [
      { assetId: pool.token0.id, amount: '266.76' },
      { assetId: pool.token1.id, amount: '0.0957' },
    ];
    expect(
      sortByPair(pool, items, (item) => item.assetId).map(
        (item) => item.assetId,
      ),
    ).toEqual([pool.token1.id, pool.token0.id]);
    // Already base first: unchanged
    const base0 = poolOf('base-v3-weth-usdc-500');
    const ordered = [
      { assetId: base0.token0.id, amount: '1' },
      { assetId: base0.token1.id, amount: '2' },
    ];
    expect(sortByPair(base0, ordered, (item) => item.assetId)).toEqual(ordered);
    // No pool, no order to follow
    expect(sortByPair(undefined, items, (item) => item.assetId)).toBe(items);
  });

  it('keeps swap amounts short only from a million up', () => {
    expect(formatTokenAmountShort('44965168.601', 'PEPE')).toBe('44.97M PEPE');
    expect(formatTokenAmountShort('233.2388', 'USDC')).toBe('233.2388 USDC');
    expect(formatCompactTokenAmount('26376.6471', 'WETH')).toBe('26.38K WETH');
  });

  it('counts the zeros of a tiny price, as Market does', () => {
    expect(formatTokenPrice('0.000000001683')).toBe('0.0₈1683');
    expect(formatTokenPrice('0.000000000012')).toBe('0.0₁₀12');
    // Up to four zeros stay written out
    expect(formatTokenPrice('0.00004518')).toBe('0.00004518');
    expect(formatTokenPrice('3000')).toBe('3,000.00');
  });

  it('gives a price against today’s', () => {
    const now = new BigNumber(2430.83);
    expect(formatPriceChange(new BigNumber(2138.84), now)).toBe('-12.01%');
    expect(formatPriceChange(new BigNumber(2721.69), now)).toBe('+11.97%');
    expect(formatPriceChange(new BigNumber(1), new BigNumber(0))).toBe(
      undefined,
    );
  });
});
