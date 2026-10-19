import BigNumber from 'bignumber.js';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { IPool } from '@onekeyhq/shared/types/pools';

import {
  formatPercent,
  formatTokenAmount,
  formatUsd,
  getPoolPair,
} from '../poolsFormat';

/**
 * Two token amounts as a value-weighted bar and one row per token, base
 * first. Used for the pool's reserves and for a position.
 */
export function PoolTokenSplit({
  pool,
  amount0,
  amount1,
}: {
  pool: IPool;
  amount0: BigNumber.Value;
  amount1: BigNumber.Value;
}) {
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
            bg={index === 0 ? '$text' : '$iconSubdued'}
          />
        ))}
      </XStack>
      {rows.map((row) => (
        <XStack key={row.token.id} ai="center" gap="$3">
          <Token
            size="sm"
            tokenImageUri={row.token.logoURI}
            borderRadius="$full"
          />
          <YStack flex={1}>
            <SizableText size="$bodyLgMedium">
              {formatTokenAmount(row.amount, row.token.symbol)}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              {formatUsd(row.valueUsd)}
            </SizableText>
          </YStack>
          <SizableText size="$bodyLgMedium">
            {formatPercent(row.valueUsd / total, 1)}
          </SizableText>
        </XStack>
      ))}
    </YStack>
  );
}
