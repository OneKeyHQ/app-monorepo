import type { IPoolTickLiquidityNet } from '@onekeyhq/shared/types/pools';

import { MAX_TICK, MIN_TICK } from './tickMath';

const ZERO = BigInt(0);

export type ILiquiditySegment = {
  /** Inclusive */
  tickLower: number;
  /** Exclusive */
  tickUpper: number;
  liquidity: bigint;
};

/**
 * Active liquidity per tick interval, rebuilt from liquidityNet by walking
 * out from the current tick: crossing a tick upward adds its net, crossing
 * it downward subtracts it.
 */
export function buildLiquiditySegments({
  ticks,
  currentTick,
  activeLiquidity,
}: {
  ticks: IPoolTickLiquidityNet[];
  currentTick: number;
  activeLiquidity: bigint;
}): ILiquiditySegment[] {
  const sorted = ticks.toSorted((a, b) => a.tick - b.tick);
  if (sorted.length === 0) {
    return [];
  }
  const nets = sorted.map((item) => BigInt(item.liquidityNet));
  // Segment 0 lies below the first tick; segment i + 1 starts at tick i
  const bounds = [MIN_TICK, ...sorted.map((item) => item.tick), MAX_TICK];
  const liquidity: bigint[] = Array.from(
    { length: sorted.length + 1 },
    () => ZERO,
  );
  let current = 0;
  sorted.forEach((item, index) => {
    if (item.tick <= currentTick) {
      current = index + 1;
    }
  });
  liquidity[current] = activeLiquidity;
  for (let i = current + 1; i < liquidity.length; i += 1) {
    liquidity[i] = liquidity[i - 1] + nets[i - 1];
  }
  for (let i = current - 1; i >= 0; i -= 1) {
    liquidity[i] = liquidity[i + 1] - nets[i];
  }
  return liquidity.map((value, index) => ({
    tickLower: bounds[index],
    tickUpper: bounds[index + 1],
    // Inconsistent snapshots must not draw negative bars
    liquidity: value > ZERO ? value : ZERO,
  }));
}

/** Average liquidity over equal-width tick buckets, for charts */
export function bucketLiquidity({
  segments,
  fromTick,
  toTick,
  bucketCount,
}: {
  segments: ILiquiditySegment[];
  fromTick: number;
  toTick: number;
  bucketCount: number;
}): ILiquiditySegment[] {
  const span = toTick - fromTick;
  if (span <= 0 || bucketCount <= 0) {
    return [];
  }
  return Array.from({ length: bucketCount }, (_, index) => {
    const tickLower = Math.round(fromTick + (span * index) / bucketCount);
    const tickUpper = Math.round(fromTick + (span * (index + 1)) / bucketCount);
    const width = Math.max(tickUpper - tickLower, 1);
    let weighted = ZERO;
    for (const segment of segments) {
      const overlap =
        Math.min(segment.tickUpper, tickUpper) -
        Math.max(segment.tickLower, tickLower);
      if (overlap > 0) {
        weighted += segment.liquidity * BigInt(overlap);
      }
    }
    return { tickLower, tickUpper, liquidity: weighted / BigInt(width) };
  });
}
