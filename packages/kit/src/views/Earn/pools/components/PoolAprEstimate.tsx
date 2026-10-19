import { SizableText, XStack, YStack } from '@onekeyhq/components';
import type { IPoolsAprEstimate } from '@onekeyhq/shared/src/utils/poolsMath';
import type { IPool } from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import { formatPercent } from '../poolsFormat';

type IAprEstimateDisplay = {
  value: string;
  /** Why the figure is missing or zero; a plain estimate has none */
  notes: string[];
  color: '$text' | '$textSubdued' | '$textCaution';
};

/**
 * The estimate as one figure. Doc §3.5 also shows the multiple of the pool
 * average and a small-deposit label; both stay out to keep the figure short.
 * Out of range needs no note: the time in range beside it says so.
 */
export function describeAprEstimate(
  estimate: IPoolsAprEstimate | undefined,
  pool: IPool,
): IAprEstimateDisplay {
  if (!estimate || estimate.status === 'unavailable') {
    return {
      value: POOLS_COPY.aprUnavailable,
      notes:
        pool.hook && !pool.aprEstimateSupported
          ? [POOLS_COPY.aprUnavailableHook]
          : [],
      color: '$textSubdued',
    };
  }
  if (estimate.status === 'outOfRange') {
    return { value: formatPercent(0), notes: [], color: '$textCaution' };
  }
  if (estimate.status === 'noFees') {
    return {
      value: formatPercent(0),
      notes: [POOLS_COPY.aprNoFees],
      color: '$text',
    };
  }
  // Earn paints an APR green only for a bonus, so a plain estimate stays $text
  return { value: formatPercent(estimate.apr), notes: [], color: '$text' };
}

/**
 * Estimated fee APR for the amount entered, or for a small deposit before
 * one is (doc §3.5).
 */
export function PoolAprEstimate({
  estimate,
  pool,
}: {
  estimate: IPoolsAprEstimate | undefined;
  pool: IPool;
}) {
  const info = describeAprEstimate(estimate, pool);
  return (
    <YStack gap="$1">
      <XStack jc="space-between" ai="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          {POOLS_COPY.estimatedApr}
        </SizableText>
        <SizableText size="$headingMd" color={info.color}>
          {info.value}
        </SizableText>
      </XStack>
      {info.notes.map((note) => (
        <SizableText
          key={note}
          size="$bodySm"
          color="$textSubdued"
          textAlign="right"
        >
          {note}
        </SizableText>
      ))}
    </YStack>
  );
}

/**
 * The estimate as a figure beside the range presets, so a preset's effect
 * shows where it is picked.
 */
export function PoolAprFigure({
  estimate,
  pool,
}: {
  estimate: IPoolsAprEstimate | undefined;
  pool: IPool;
}) {
  const info = describeAprEstimate(estimate, pool);
  return (
    <YStack gap="$0.5" flexShrink={1}>
      <SizableText size="$bodySm" color="$textSubdued">
        {POOLS_COPY.estimatedApr}
      </SizableText>
      <SizableText size="$headingXl" color={info.color}>
        {info.value}
      </SizableText>
      {info.notes.map((note) => (
        <SizableText key={note} size="$bodySm" color="$textSubdued">
          {note}
        </SizableText>
      ))}
    </YStack>
  );
}
