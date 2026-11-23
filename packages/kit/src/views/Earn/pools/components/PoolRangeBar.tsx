import { SizableText, XStack, YStack } from '@onekeyhq/components';
import {
  getDisplayRange,
  isFullRange,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type {
  IPool,
  IPoolTickLiquidityNet,
} from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import {
  formatTokenPrice,
  getPoolDisplayPrice,
  getPoolPair,
} from '../poolsFormat';

import { PoolStrataPreview } from './PoolPositionStrata';

import type { IStrataPosition } from '../poolsStrata';

/**
 * Display min, max and current price of a range, in the pair's direction, or
 * the other way round when the page's chart is flipped
 */
export function getRangeDisplay(
  pool: IPool,
  range: { tickLower: number; tickUpper: number },
  flipped = false,
) {
  const tickSpacing = pool.tickSpacing ?? 60;
  const display = getDisplayRange({
    ...range,
    tickSpacing,
    decimals0: pool.token0.decimals,
    decimals1: pool.token1.decimals,
    inverted: getPoolPair(pool).inverted !== flipped,
  });
  return {
    ...display,
    isFull: isFullRange({ ...range, tickSpacing }),
    current: getPoolDisplayPrice(pool, flipped),
  };
}

/**
 * A position's range against its pool's liquidity: the pool's bars with the
 * position's piece on top, the price as a line. Its bounds read under it.
 */
export function PoolRangeBar({
  pool,
  ticks,
  position,
  inRange,
  showLabels = true,
  flipped = false,
}: {
  pool: IPool;
  /** Undefined while the pool's detail loads */
  ticks: IPoolTickLiquidityNet[] | undefined;
  position: IStrataPosition;
  inRange: boolean;
  showLabels?: boolean;
  /** Reads the way a flipped price chart on the same page does */
  flipped?: boolean;
}) {
  const range = getRangeDisplay(pool, position, flipped);
  let labels = null;
  if (showLabels) {
    labels = range.isFull ? (
      <SizableText size="$bodySm" color="$textSubdued">
        {POOLS_COPY.fullRange}
      </SizableText>
    ) : (
      <XStack jc="space-between">
        <SizableText size="$bodySm" color="$textSubdued">
          {`${POOLS_COPY.rangeMin} ${formatTokenPrice(range.min)}`}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {`${POOLS_COPY.rangeMax} ${formatTokenPrice(range.max)}`}
        </SizableText>
      </XStack>
    );
  }
  return (
    <YStack gap="$1.5">
      <PoolStrataPreview
        pool={pool}
        ticks={ticks}
        position={position}
        inRange={inRange}
        flipped={flipped}
      />
      {labels}
    </YStack>
  );
}
