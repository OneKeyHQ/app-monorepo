import type { ReactNode } from 'react';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar';
import type { IPool } from '@onekeyhq/shared/types/pools';

import { getPoolPairTitle } from '../poolsFormat';

import { PoolPairIcon } from './PoolPairIcon';
import { PoolTags, usePoolNetworkName } from './PoolTags';

/** A pool's name, its badges and its network; position pages add a status */
export function PoolHeader({
  pool,
  status,
  right,
}: {
  pool: IPool;
  /** A position's status, after the network */
  status?: ReactNode;
  /** Actions on the right, e.g. star and share */
  right?: ReactNode;
}) {
  const networkName = usePoolNetworkName(pool.networkId);
  return (
    <XStack ai="center" gap="$4">
      <PoolPairIcon pool={pool} size="lg" />
      <YStack gap="$1.5" flex={1} minWidth={0}>
        <SizableText size="$heading2xl" numberOfLines={1}>
          {getPoolPairTitle(pool)}
        </SizableText>
        <XStack ai="center" gap="$3" flexWrap="wrap">
          <PoolTags pool={pool} />
          <XStack ai="center" gap="$1.5">
            <NetworkAvatar networkId={pool.networkId} size="$4" />
            <SizableText size="$bodyMd" color="$textSubdued">
              {networkName}
            </SizableText>
          </XStack>
          {status}
        </XStack>
      </YStack>
      {right}
    </XStack>
  );
}
