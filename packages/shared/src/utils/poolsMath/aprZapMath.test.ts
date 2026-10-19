import BigNumber from 'bignumber.js';

import { EPoolPositionStatus } from '@onekeyhq/shared/types/pools';

import { estimateRangeApr, estimateShareApr, getPoolFeeApr } from './aprMath';
import {
  bucketLiquidity,
  buildLiquiditySegments,
} from './liquidityDistribution';
import { getRangePositionStatus } from './positionMath';
import {
  estimateZapOut,
  mergeAssetAmounts,
  planZapSplit,
  splitZapInput,
} from './zapMath';

describe('fee APR (doc §3.5)', () => {
  const pool = { fees24hUsd: (1_000_000 * 0.1) / 365, tvlUsd: 1_000_000 };

  it('computes the pool average', () => {
    expect(getPoolFeeApr(pool)?.toNumber()).toBeCloseTo(0.1, 12);
    expect(getPoolFeeApr({ fees24hUsd: 1, tvlUsd: 0 })).toBeUndefined();
  });

  it('reproduces the doc example: 3.6× and 36%', () => {
    // L ÷ (L_active + L) = 0.36%
    const estimate = estimateRangeApr({
      ...pool,
      activeLiquidity: BigInt(9964),
      inRange: true,
      supported: true,
      deposit: { liquidity: BigInt(36), valueUsd: 1000 },
    });
    expect(estimate.status).toBe('ok');
    if (estimate.status === 'ok') {
      expect(estimate.multiple?.toNumber()).toBeCloseTo(3.6, 10);
      expect(estimate.apr.toNumber()).toBeCloseTo(0.36, 10);
      expect(estimate.isSmallAmount).toBe(false);
    }
  });

  it('estimates a tiny deposit before an amount is entered', () => {
    const estimate = estimateRangeApr({
      ...pool,
      activeLiquidity: BigInt(1_000_000),
      inRange: true,
      supported: true,
      reference: { liquidity: BigInt(500), valueUsd: 100 },
    });
    // B = TVL × (L ÷ V) ÷ L_active = 1e6 × 5 ÷ 1e6
    expect(estimate.status === 'ok' && estimate.multiple?.toNumber()).toBe(5);
    expect(estimate.status === 'ok' && estimate.isSmallAmount).toBe(true);
  });

  it('handles the boundary cases', () => {
    const base = {
      ...pool,
      activeLiquidity: BigInt(10),
      inRange: true,
      supported: true,
      deposit: { liquidity: BigInt(1), valueUsd: 10 },
    };
    expect(estimateRangeApr({ ...base, inRange: false }).status).toBe(
      'outOfRange',
    );
    expect(
      estimateRangeApr({ ...base, activeLiquidity: BigInt(0) }).status,
    ).toBe('unavailable');
    expect(estimateRangeApr({ ...base, tvlUsd: 0 }).status).toBe('unavailable');
    expect(estimateRangeApr({ ...base, supported: false }).status).toBe(
      'unavailable',
    );
    expect(estimateRangeApr({ ...base, fees24hUsd: 0 }).status).toBe('noFees');
  });

  it('dilutes share pools by TVL ÷ (TVL + V)', () => {
    const estimate = estimateShareApr({ ...pool, depositUsd: 1_000_000 });
    expect(estimate.status === 'ok' && estimate.apr.toNumber()).toBeCloseTo(
      0.05,
      12,
    );
  });
});

describe('Zap in (doc §3.6)', () => {
  // TSLA / USDG at 400, range 360 to 440, 1,000 USDG in (USDG is token1)
  const a0 = new BigNumber(1)
    .div(new BigNumber(400).sqrt())
    .minus(new BigNumber(1).div(new BigNumber(440).sqrt()));
  const a1 = new BigNumber(400).sqrt().minus(new BigNumber(360).sqrt());

  it('reproduces the worked example', () => {
    const split = splitZapInput({
      amountIn: 1000,
      perLiquidity0: a0,
      perLiquidity1: a1,
      rate0: '0.0024925',
      rate1: 1,
    });
    expect(split.toToken0.toFixed(1)).toBe('476.3');
    expect(split.toToken1.toFixed(1)).toBe('523.7');
    expect(split.toToken0.times('0.0024925').toFixed(3)).toBe('1.187');
  });

  it('sends everything to one side when the range takes one token', () => {
    const split = splitZapInput({
      amountIn: 1000,
      perLiquidity0: 0,
      perLiquidity1: a1,
      rate0: 0,
      rate1: 1,
    });
    expect(split.toToken0.toNumber()).toBe(0);
    expect(split.toToken1.toNumber()).toBe(1000);
  });

  it('re-quotes the split amounts once', async () => {
    const quotes: number[] = [];
    // 0.3% fee plus impact that grows with size
    const quote = async ({ amountIn }: { amountIn: BigNumber }) => {
      quotes.push(amountIn.toNumber());
      const impact = amountIn.div(1_000_000);
      return amountIn.times('0.0025').times(new BigNumber(0.997).minus(impact));
    };
    const plan = await planZapSplit({
      amountIn: 1000,
      perLiquidity0: a0,
      perLiquidity1: a1,
      inputSide: 1,
      quote,
    });
    // Full amount first, then the split amount
    expect(quotes).toHaveLength(2);
    expect(quotes[0]).toBe(1000);
    expect(plan.toToken0.plus(plan.toToken1).toNumber()).toBeCloseTo(1000, 12);
    expect(plan.expected1.toNumber()).toBeCloseTo(plan.toToken1.toNumber(), 12);
    // The deposit ratio holds after the corrected quote
    expect(
      plan.expected0.div(plan.expected1).div(a0.div(a1)).toNumber(),
    ).toBeCloseTo(1, 6);
  });

  it('fails clearly when a needed side has no route', () => {
    expect(() =>
      splitZapInput({
        amountIn: 1,
        perLiquidity0: a0,
        perLiquidity1: a1,
        rate0: 0,
        rate1: 1,
      }),
    ).toThrow();
  });
});

describe('Zap out (doc §3.7) and exiting several positions', () => {
  it('sums both legs into the target', () => {
    expect(
      estimateZapOut([
        { amount: 2, rate: 3000 },
        { amount: 500, rate: 1 },
      ]).toNumber(),
    ).toBe(6500);
  });

  it('merges the same asset across positions so it swaps once', () => {
    const merged = mergeAssetAmounts([
      { assetId: 'eth', amount: '1.5' },
      { assetId: 'usdc', amount: '100' },
      { assetId: 'eth', amount: '0.5' },
      { assetId: 'usdt', amount: '0' },
    ]);
    expect(
      merged.map((item) => [item.assetId, item.amount.toNumber()]),
    ).toEqual([
      ['eth', 2],
      ['usdc', 100],
    ]);
  });
});

describe('position status (doc §3.9)', () => {
  const range = { tickLower: -60, tickUpper: 60 };

  it('follows tickLower <= tick < tickUpper', () => {
    expect(
      getRangePositionStatus({
        ...range,
        liquidity: BigInt(1),
        currentTick: -60,
      }),
    ).toEqual({ status: EPoolPositionStatus.Active });
    expect(
      getRangePositionStatus({
        ...range,
        liquidity: BigInt(1),
        currentTick: 60,
      }),
    ).toEqual({
      status: EPoolPositionStatus.OutOfRange,
      outOfRangeSide: 'above',
    });
    expect(
      getRangePositionStatus({
        ...range,
        liquidity: BigInt(1),
        currentTick: -61,
      }),
    ).toEqual({
      status: EPoolPositionStatus.OutOfRange,
      outOfRangeSide: 'below',
    });
    expect(
      getRangePositionStatus({ ...range, liquidity: BigInt(0), currentTick: 0 })
        .status,
    ).toBe(EPoolPositionStatus.Closed);
  });
});

describe('liquidity distribution', () => {
  // Two positions: [-120, 120) with 100 and [0, 240) with 50
  const ticks = [
    { tick: -120, liquidityNet: '100' },
    { tick: 0, liquidityNet: '50' },
    { tick: 120, liquidityNet: '-100' },
    { tick: 240, liquidityNet: '-50' },
  ];

  it('rebuilds liquidity on both sides of the current tick', () => {
    const segments = buildLiquiditySegments({
      ticks,
      currentTick: 30,
      activeLiquidity: BigInt(150),
    });
    expect(segments.map((s) => [s.tickLower, Number(s.liquidity)])).toEqual([
      [-887_272, 0],
      [-120, 100],
      [0, 150],
      [120, 50],
      [240, 0],
    ]);
  });

  it('averages segments into buckets', () => {
    const segments = buildLiquiditySegments({
      ticks,
      currentTick: 30,
      activeLiquidity: BigInt(150),
    });
    const buckets = bucketLiquidity({
      segments,
      fromTick: -120,
      toTick: 120,
      bucketCount: 2,
    });
    expect(buckets.map((b) => Number(b.liquidity))).toEqual([100, 150]);
  });
});
