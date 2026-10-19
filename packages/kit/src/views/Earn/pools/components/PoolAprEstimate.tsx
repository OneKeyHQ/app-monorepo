import { SizableText, XStack, YStack } from '@onekeyhq/components';
import type { IPoolsAprEstimate } from '@onekeyhq/shared/src/utils/poolsMath';
import type { IPool } from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import { formatPercent } from '../poolsFormat';

function describe(estimate: IPoolsAprEstimate | undefined, pool: IPool) {
  if (!estimate || estimate.status === 'unavailable') {
    return {
      value: POOLS_COPY.aprUnavailable,
      notes:
        pool.hook && !pool.aprEstimateSupported
          ? [POOLS_COPY.aprUnavailableHook]
          : [],
      color: '$textSubdued',
    } as const;
  }
  if (estimate.status === 'outOfRange') {
    return {
      value: formatPercent(0),
      notes: [POOLS_COPY.aprOutOfRange],
      color: '$textCaution',
    } as const;
  }
  if (estimate.status === 'noFees') {
    return {
      value: formatPercent(0),
      notes: [POOLS_COPY.aprNoFees],
      color: '$text',
    } as const;
  }
  const notes: string[] = [];
  if (estimate.multiple) {
    notes.push(POOLS_COPY.vsPoolAverage(estimate.multiple.toFixed(1)));
  }
  if (estimate.isSmallAmount) {
    notes.push(POOLS_COPY.estimatedForSmallAmount);
  }
  return {
    value: formatPercent(estimate.apr),
    notes,
    color: '$textSuccess',
  } as const;
}

/**
 * Estimated fee APR for the chosen range and amount, with the multiple of
 * the pool average (doc §3.5). Before an amount is entered it estimates a
 * small deposit.
 */
export function PoolAprEstimate({
  estimate,
  pool,
}: {
  estimate: IPoolsAprEstimate | undefined;
  pool: IPool;
}) {
  const info = describe(estimate, pool);
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
