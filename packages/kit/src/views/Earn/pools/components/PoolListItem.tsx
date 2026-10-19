import { SizableText, YStack } from '@onekeyhq/components';
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
import { PoolTags } from './PoolTags';

/** Phone row: pair and tags on the left, APR over TVL on the right */
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
      renderAvatar={<PoolPairIcon pool={pool} size="md" showNetwork />}
    >
      <ListItem.Text
        flex={1}
        primary={
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {getPoolPairTitle(pool)}
          </SizableText>
        }
        secondary={<PoolTags pool={pool} mt="$1" />}
      />
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
