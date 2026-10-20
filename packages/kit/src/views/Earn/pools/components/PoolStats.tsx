import { SizableText, XStack, YStack } from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';
import type { IPoolListItem } from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import { formatCompactUsd, formatFeeTier, formatPercent } from '../poolsFormat';

// Changes this small read as flat
const FLAT_CHANGE = 0.0005;

/** A change against the window before, as Revert prints it under a value */
export function PoolChangeText({
  change,
  points = false,
  size = '$bodySm',
}: {
  change: string | undefined;
  /** A rate's change, in percentage points */
  points?: boolean;
  size?: ISizableTextProps['size'];
}) {
  const value = Number(change);
  if (change === undefined || !Number.isFinite(value)) {
    return null;
  }
  let color: ISizableTextProps['color'] = '$textSubdued';
  if (value > FLAT_CHANGE) {
    color = '$textSuccess';
  } else if (value < -FLAT_CHANGE) {
    color = '$textCritical';
  }
  const percent = value * 100;
  const sign = percent >= 0 ? '+' : '';
  let text: string;
  if (points) {
    text = POOLS_COPY.points(`${sign}${percent.toFixed(2)}`);
  } else {
    const digits = Math.abs(percent) >= 100 ? 0 : 1;
    text = `${sign}${percent.toFixed(digits)}%`;
  }
  return (
    <SizableText size={size} color={color} numberOfLines={1}>
      {text}
    </SizableText>
  );
}

function Stat({
  label,
  value,
  change,
  changeInPoints,
  width,
}: {
  label: string;
  value: string;
  change?: string;
  changeInPoints?: boolean;
  width?: string;
}) {
  return (
    <YStack gap="$1" width={width} minWidth={0} pb="$1">
      <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
        {label}
      </SizableText>
      <XStack ai="baseline" gap="$2" flexWrap="wrap">
        <SizableText size="$headingXl" numberOfLines={1}>
          {value}
        </SizableText>
        <PoolChangeText
          change={change}
          points={changeInPoints}
          size="$bodyMdMedium"
        />
      </XStack>
    </YStack>
  );
}

/**
 * The pool's last 24 hours with the change against the day before; a
 * dynamic-fee pool adds the fee it charges now.
 */
export function PoolStatsStrip({
  pool,
  compact,
}: {
  pool: IPoolListItem;
  /** Two per line, for phones */
  compact?: boolean;
}) {
  const day = pool.windows['1D'];
  const width = compact ? '50%' : undefined;
  return (
    <XStack
      testID="earn-pool-stats"
      flexWrap="wrap"
      rowGap="$4"
      columnGap={compact ? '$0' : '$10'}
    >
      <Stat
        label={POOLS_COPY.tvl}
        value={formatCompactUsd(pool.tvlUsd)}
        change={day.tvlChange}
        width={width}
      />
      <Stat
        label={POOLS_COPY.volume24h}
        value={formatCompactUsd(day.volumeUsd)}
        change={day.volumeChange}
        width={width}
      />
      <Stat
        label={POOLS_COPY.fees24h}
        value={formatCompactUsd(day.feesUsd)}
        change={day.feesChange}
        width={width}
      />
      <Stat
        label={POOLS_COPY.poolApr}
        value={formatPercent(day.apr)}
        change={day.aprChange}
        changeInPoints
        width={width}
      />
      {pool.isDynamicFee ? (
        <Stat
          label={POOLS_COPY.currentFee}
          value={formatFeeTier(pool.feeTier)}
          width={width}
        />
      ) : null}
    </XStack>
  );
}
