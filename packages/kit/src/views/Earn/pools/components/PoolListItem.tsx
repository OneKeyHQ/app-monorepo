import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IPoolListItem } from '@onekeyhq/shared/types/pools';

import { EarnAprSuffixText } from '../../components/EarnAprSuffixText';
import { POOLS_COPY } from '../poolsCopy';
import {
  formatCompactUsd,
  formatPercent,
  getPoolPairTitle,
} from '../poolsFormat';

import { PoolPairIcon } from './PoolPairIcon';
import { PoolBadges, getPoolVersionFee } from './PoolTags';

/** The pair in bold with its badges, version and fee on the line under it */
export function PoolNameCell({ pool }: { pool: IPoolListItem }) {
  return (
    <YStack flexShrink={1} minWidth={0} gap="$0.5">
      <XStack ai="center" gap="$2" minWidth={0}>
        <SizableText size="$bodyLgMedium" numberOfLines={1} flexShrink={1}>
          {getPoolPairTitle(pool)}
        </SizableText>
        <PoolBadges pool={pool} />
      </XStack>
      <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
        {getPoolVersionFee(pool)}
      </SizableText>
    </YStack>
  );
}

/** Phone row: the pool on the left, APR over TVL on the right */
export function PoolListItem({
  pool,
  testID,
  onPress,
}: {
  pool: IPoolListItem;
  testID?: string;
  onPress: () => void;
}) {
  return (
    <ListItem
      testID={testID}
      userSelect="none"
      onPress={onPress}
      renderAvatar={<PoolPairIcon pool={pool} size="md" />}
    >
      <YStack flex={1} minWidth={0}>
        <PoolNameCell pool={pool} />
      </YStack>
      <YStack ai="flex-end" jc="center" gap="$0.5">
        <EarnAprSuffixText
          text={`${formatPercent(pool.feeApr)} ${POOLS_COPY.apr}`}
        />
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
          {`${formatCompactUsd(pool.tvlUsd)} ${POOLS_COPY.tvl}`}
        </SizableText>
      </YStack>
    </ListItem>
  );
}
