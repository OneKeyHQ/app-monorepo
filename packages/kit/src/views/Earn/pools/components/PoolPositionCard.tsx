import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { EPoolPositionStatus } from '@onekeyhq/shared/types/pools';
import type {
  IPoolPositionView,
  IPoolTickLiquidityNet,
} from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import {
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

/**
 * A position as a card (doc §2.6): pair, version and fee, value, both
 * amounts, status; range positions add their range against the pool's
 * liquidity and unclaimed fees.
 */
export function PoolPositionCard({
  view,
  ticks,
  onPress,
  testID,
}: {
  view: IPoolPositionView;
  /** The pool's liquidity its range is drawn against; undefined while loading */
  ticks: IPoolTickLiquidityNet[] | undefined;
  onPress?: () => void;
  testID?: string;
}) {
  const { pool, position } = view;
  const hasRange =
    pool.capabilities.priceRange &&
    position.tickLower !== undefined &&
    position.tickUpper !== undefined &&
    view.status !== EPoolPositionStatus.Closed;
  const hasFees = Number(view.uncollectedFeesUsd) > 0;

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
        <YStack ai="flex-end" gap="$1">
          <SizableText size="$bodyLgMedium">
            {formatUsd(view.valueUsd)}
          </SizableText>
          <PoolPositionStatus view={view} />
        </YStack>
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
