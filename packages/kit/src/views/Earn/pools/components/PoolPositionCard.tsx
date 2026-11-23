import BigNumber from 'bignumber.js';

import { Icon, SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';
import { EPoolPositionStatus } from '@onekeyhq/shared/types/pools';
import type {
  IPoolPositionView,
  IPoolTickLiquidityNet,
} from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import {
  formatPercent,
  formatTokenAmount,
  formatUsd,
  getPoolPair,
  getPoolPairTitle,
} from '../poolsFormat';

import { PoolPairIcon } from './PoolPairIcon';
import { PoolRangeBar } from './PoolRangeBar';
import { PoolTags } from './PoolTags';

export function getPositionStatusInfo(view: IPoolPositionView) {
  const isRange = view.pool.capabilities.priceRange;
  switch (view.status) {
    case EPoolPositionStatus.Active:
      return {
        label: isRange ? POOLS_COPY.inRange : POOLS_COPY.active,
        color: '$textSuccess',
        dot: '$iconSuccess',
      } as const;
    case EPoolPositionStatus.OutOfRange:
      return {
        label: POOLS_COPY.outOfRange,
        color: '$textCaution',
        dot: '$iconCaution',
      } as const;
    default:
      return {
        label: POOLS_COPY.closed,
        color: '$textSubdued',
        dot: '$iconDisabled',
      } as const;
  }
}

/**
 * What an open position earns now, as one figure: 0% in amber out of
 * range. Closed positions have none.
 */
export function describeCurrentApr(
  view: IPoolPositionView,
): { value: string; color: ISizableTextProps['color'] } | undefined {
  if (view.status === EPoolPositionStatus.Closed) {
    return undefined;
  }
  if (view.currentApr === undefined) {
    // A hook that changes LP fees
    return { value: POOLS_COPY.aprUnavailable, color: '$textSubdued' };
  }
  return {
    value: formatPercent(view.currentApr),
    color:
      view.status === EPoolPositionStatus.OutOfRange ? '$textCaution' : '$text',
  };
}

/** Fees since opening as the position page shows them; none when they compound */
export function getFeesEarnedText(view: IPoolPositionView) {
  if (view.pool.capabilities.feeCollection === 'AUTO_COMPOUND') {
    return undefined;
  }
  const earned = new BigNumber(view.feesEarnedUsd);
  return earned.gt(0)
    ? { value: `+${formatUsd(earned)}`, color: '$textSuccess' as const }
    : { value: formatUsd(0), color: '$text' as const };
}

export function PoolPositionStatus({ view }: { view: IPoolPositionView }) {
  const info = getPositionStatusInfo(view);
  return (
    <XStack ai="center" gap="$1.5">
      <Stack w={6} h={6} borderRadius="$full" bg={info.dot} />
      <SizableText size="$bodySmMedium" color={info.color}>
        {info.label}
      </SizableText>
    </XStack>
  );
}

/** Both token amounts, base first, each in its own slot */
export function PoolPositionAmounts({ view }: { view: IPoolPositionView }) {
  const { inverted } = getPoolPair(view.pool);
  const amounts = [
    { token: view.pool.token0, amount: view.amount0 },
    { token: view.pool.token1, amount: view.amount1 },
  ];
  const ordered = inverted ? amounts.toReversed() : amounts;
  return (
    <XStack gap="$4" flexWrap="wrap">
      {ordered.map(({ token, amount }) => (
        <SizableText key={token.id} size="$bodyMd">
          {formatTokenAmount(amount, token.symbol)}
        </SizableText>
      ))}
    </XStack>
  );
}

function CardFigure({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: ISizableTextProps['color'];
}) {
  return (
    <YStack flex={1} flexBasis={0} minWidth={0} gap="$0.5">
      <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
        {label}
      </SizableText>
      <SizableText size="$bodyLgMedium" color={color} numberOfLines={1}>
        {value}
      </SizableText>
    </YStack>
  );
}

/**
 * A position as a card (doc §2.6): pair, version and fee, and status; then
 * what it is worth, has earned and earns now; both amounts. Range positions
 * add their range against the pool's liquidity and unclaimed fees.
 */
export function PoolPositionCard({
  view,
  ticks,
  onPress,
  testID,
  flipped = false,
}: {
  view: IPoolPositionView;
  /** The pool's liquidity its range is drawn against; undefined while loading */
  ticks: IPoolTickLiquidityNet[] | undefined;
  onPress?: () => void;
  testID?: string;
  /** The page's price chart is flipped, so the range reads that way too */
  flipped?: boolean;
}) {
  const { pool, position } = view;
  const hasRange =
    pool.capabilities.priceRange &&
    position.tickLower !== undefined &&
    position.tickUpper !== undefined &&
    view.status !== EPoolPositionStatus.Closed;
  const hasFees = Number(view.uncollectedFeesUsd) > 0;
  const earned = getFeesEarnedText(view);
  const apr = describeCurrentApr(view);

  return (
    <YStack
      testID={testID}
      role={onPress ? 'button' : undefined}
      p="$4"
      gap="$3"
      borderRadius="$4"
      bg="$bgSubdued"
      cursor={onPress ? 'pointer' : undefined}
      userSelect="none"
      hoverStyle={onPress ? { bg: '$bgHover' } : undefined}
      pressStyle={onPress ? { bg: '$bgActive' } : undefined}
      onPress={onPress}
    >
      <XStack ai="center" gap="$3">
        <PoolPairIcon
          pool={pool}
          size="sm"
          ringColor="$bgSubdued"
          showNetwork
        />
        <YStack flex={1} gap="$1" minWidth={0}>
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {getPoolPairTitle(pool)}
          </SizableText>
          <PoolTags pool={pool} />
        </YStack>
        {/* The chevron says the card opens, as on the portfolio cards */}
        <XStack ai="center" gap="$1" flexShrink={0}>
          <PoolPositionStatus view={view} />
          {onPress ? (
            <Icon
              name="ChevronRightSmallOutline"
              size="$5"
              color="$iconSubdued"
            />
          ) : null}
        </XStack>
      </XStack>
      <XStack gap="$3">
        <CardFigure
          label={POOLS_COPY.positionValue}
          value={formatUsd(view.valueUsd)}
        />
        {earned ? (
          <CardFigure
            label={POOLS_COPY.feesEarned}
            value={earned.value}
            color={earned.color}
          />
        ) : null}
        {apr ? (
          <CardFigure
            label={POOLS_COPY.currentApr}
            value={apr.value}
            color={apr.color}
          />
        ) : null}
      </XStack>
      <PoolPositionAmounts view={view} />
      {hasRange ? (
        <PoolRangeBar
          pool={pool}
          ticks={ticks}
          position={{
            tickLower: position.tickLower ?? 0,
            tickUpper: position.tickUpper ?? 0,
            liquidity: BigInt(position.liquidity ?? '0'),
          }}
          inRange={view.status === EPoolPositionStatus.Active}
          flipped={flipped}
        />
      ) : null}
      {hasFees ? (
        <XStack jc="space-between" ai="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {POOLS_COPY.unclaimedFees}
          </SizableText>
          <SizableText size="$bodyMdMedium">
            {formatUsd(view.uncollectedFeesUsd)}
          </SizableText>
        </XStack>
      ) : null}
    </YStack>
  );
}
