import BigNumber from 'bignumber.js';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { IPool } from '@onekeyhq/shared/types/pools';

import {
  formatCompactTokenAmount,
  formatCompactUsd,
  formatPercent,
  formatTokenAmount,
  formatUsd,
  getPoolPair,
} from '../poolsFormat';

/**
 * One color per token, base first, so a split reads without a legend.
 * Hues that carry no status: green and amber already mean earning and out
 * of range.
 */
export const POOL_TOKEN_COLORS = ['$blue9', '$purple9'] as const;

/** The token's color mark beside its amount */
export function PoolTokenDot({ index }: { index: 0 | 1 }) {
  return (
    <Stack
      w={8}
      h={8}
      borderRadius="$full"
      bg={POOL_TOKEN_COLORS[index]}
      flexShrink={0}
    />
  );
}

/**
 * Two token amounts as a value-weighted bar and one row per token, base
 * first. Used for the pool's reserves and for a position.
 */
export function PoolTokenSplit({
  pool,
  amount0,
  amount1,
  compact = false,
}: {
  pool: IPool;
  amount0: BigNumber.Value;
  amount1: BigNumber.Value;
  /** Pool reserves read like TVL (26.38K WETH); a position stays exact */
  compact?: boolean;
}) {
  const formatAmount = compact ? formatCompactTokenAmount : formatTokenAmount;
  const formatValue = compact ? formatCompactUsd : formatUsd;
  const { base, quote } = getPoolPair(pool);
  const rows = [base, quote].map((token) => {
    const amount = token.id === pool.token0.id ? amount0 : amount1;
    const valueUsd = new BigNumber(amount).times(token.priceUsd).toNumber();
    return { token, amount, valueUsd };
  });
  const total = rows.reduce((sum, row) => sum + row.valueUsd, 0) || 1;
  return (
    <YStack gap="$4">
      <XStack h={6} borderRadius="$full" overflow="hidden" gap={2}>
        {rows.map((row, index) => (
          <Stack
            key={row.token.id}
            flex={row.valueUsd / total}
            bg={POOL_TOKEN_COLORS[index]}
          />
        ))}
      </XStack>
      {rows.map((row, index) => (
        <XStack key={row.token.id} ai="center" gap="$3">
          <Token
            size="sm"
            tokenImageUri={row.token.logoURI}
            borderRadius="$full"
          />
          <YStack flex={1}>
            <SizableText size="$bodyLgMedium">
              {formatAmount(row.amount, row.token.symbol)}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              {formatValue(row.valueUsd)}
            </SizableText>
          </YStack>
          <XStack ai="center" gap="$2">
            <PoolTokenDot index={index === 0 ? 0 : 1} />
            <SizableText size="$bodyLgMedium">
              {formatPercent(row.valueUsd / total, 1)}
            </SizableText>
          </XStack>
        </XStack>
      ))}
    </YStack>
  );
}
