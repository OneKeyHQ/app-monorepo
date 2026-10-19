import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import {
  getDisplayRange,
  isFullRange,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type { IPool } from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import {
  formatTokenPrice,
  getPoolDisplayPrice,
  getPoolPair,
} from '../poolsFormat';

/** Display min, max and current price of a range, in the pair's direction */
export function getRangeDisplay(
  pool: IPool,
  range: { tickLower: number; tickUpper: number },
) {
  const tickSpacing = pool.tickSpacing ?? 60;
  const display = getDisplayRange({
    ...range,
    tickSpacing,
    decimals0: pool.token0.decimals,
    decimals1: pool.token1.decimals,
    inverted: getPoolPair(pool).inverted,
  });
  return {
    ...display,
    isFull: isFullRange({ ...range, tickSpacing }),
    current: getPoolDisplayPrice(pool),
  };
}

/**
 * Where the price sits against the range: a track, the range on it and a dot
 * for the current price (doc §2.6). Log scale, so ±10% looks symmetric.
 */
export function PoolRangeBar({
  pool,
  tickLower,
  tickUpper,
  showLabels = true,
}: {
  pool: IPool;
  tickLower: number;
  tickUpper: number;
  showLabels?: boolean;
}) {
  const range = getRangeDisplay(pool, { tickLower, tickUpper });
  if (range.isFull) {
    return (
      <SizableText size="$bodyMd" color="$textSubdued">
        {POOLS_COPY.fullRange}
      </SizableText>
    );
  }
  const min = Math.log(range.min.toNumber());
  const max = Math.log(range.max.toNumber());
  const now = Math.log(range.current.toNumber());
  const lo = Math.min(min, now);
  const hi = Math.max(max, now);
  const pad = (hi - lo) * 0.18 || 0.01;
  const toPct = (value: number) =>
    ((value - (lo - pad)) / (hi - lo + pad * 2)) * 100;
  const inRange = now >= min && now <= max;

  return (
    <YStack gap="$1.5">
      <Stack h={8} justifyContent="center">
        <Stack h={4} borderRadius="$full" bg="$bgStrong" />
        <Stack
          position="absolute"
          h={4}
          left={`${toPct(min)}%`}
          w={`${toPct(max) - toPct(min)}%`}
          borderRadius="$full"
          bg={inRange ? '$iconSuccess' : '$iconCaution'}
        />
        <Stack
          position="absolute"
          left={`${toPct(now)}%`}
          ml={-4}
          w={8}
          h={8}
          borderRadius="$full"
          bg="$icon"
          borderWidth={1.5}
          borderColor="$bgApp"
        />
      </Stack>
      {showLabels ? (
        <XStack jc="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            {`${POOLS_COPY.rangeMin} ${formatTokenPrice(range.min)}`}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {`${POOLS_COPY.rangeMax} ${formatTokenPrice(range.max)}`}
          </SizableText>
        </XStack>
      ) : null}
    </YStack>
  );
}
