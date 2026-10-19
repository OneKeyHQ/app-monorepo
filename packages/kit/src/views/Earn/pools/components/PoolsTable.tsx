import { useCallback, useMemo } from 'react';
import type { ComponentProps } from 'react';

import { SizableText, XStack, useMedia } from '@onekeyhq/components';
import { TableList } from '@onekeyhq/kit/src/components/ListView/TableList';
import type { ITableColumn } from '@onekeyhq/kit/src/components/ListView/TableList';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IPoolListItem } from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import {
  formatCompactUsd,
  formatPercent,
  getPoolPairTitle,
} from '../poolsFormat';

import { PoolListItem } from './PoolListItem';
import { PoolPairIcon } from './PoolPairIcon';
import { PoolTags } from './PoolTags';

/**
 * Pools table for the desktop Earn page. Two number columns only, TVL and
 * APR; 24h volume lives on the pool page (proposal, doc §2.3 lists it).
 */
export function PoolsTable({
  pools,
  isLoading,
  onPressPool,
  ListEmptyComponent,
}: {
  pools: IPoolListItem[];
  isLoading?: boolean;
  onPressPool: (pool: IPoolListItem) => void;
  ListEmptyComponent?: ComponentProps<typeof TableList>['ListEmptyComponent'];
}) {
  const media = useMedia();

  const columns = useMemo<ITableColumn<IPoolListItem>[]>(
    () => [
      {
        key: 'pool',
        label: POOLS_COPY.pool,
        flex: 2.6,
        render: (pool) => (
          <XStack ai="center" gap="$3" minWidth={0}>
            <PoolPairIcon pool={pool} size="md" />
            <SizableText size="$bodyLgMedium" numberOfLines={1} flexShrink={0}>
              {getPoolPairTitle(pool)}
            </SizableText>
            <PoolTags pool={pool} flexShrink={1} />
          </XStack>
        ),
      },
      {
        key: 'network',
        label: POOLS_COPY.network,
        flex: 0.8,
        hideInMobile: true,
        render: (pool) => (
          <NetworkAvatar networkId={pool.networkId} size="$5" />
        ),
      },
      {
        key: 'tvl',
        label: POOLS_COPY.tvl,
        flex: 1,
        align: 'flex-end',
        sortable: true,
        comparator: (a, b) => Number(a.tvlUsd) - Number(b.tvlUsd),
        render: (pool) => (
          <SizableText size="$bodyLgMedium">
            {formatCompactUsd(pool.tvlUsd)}
          </SizableText>
        ),
      },
      {
        key: 'apr',
        label: POOLS_COPY.apr,
        flex: 1,
        align: 'flex-end',
        sortable: true,
        comparator: (a, b) => Number(a.feeApr ?? 0) - Number(b.feeApr ?? 0),
        render: (pool) => (
          <SizableText size="$bodyLgMedium">
            {formatPercent(pool.feeApr)}
          </SizableText>
        ),
      },
    ],
    [],
  );

  const keyExtractor = useCallback((pool: IPoolListItem) => pool.id, []);

  const mobileRenderItem = useCallback(
    (pool: IPoolListItem) => (
      <PoolListItem pool={pool} onPress={() => onPressPool(pool)} />
    ),
    [onPressPool],
  );

  return (
    <TableList<IPoolListItem>
      data={pools}
      columns={columns}
      keyExtractor={keyExtractor}
      withHeader={platformEnv.isNative ? false : media.gtMd}
      defaultSortKey="tvl"
      defaultSortDirection="desc"
      onPressRow={onPressPool}
      mobileRenderItem={mobileRenderItem}
      enableDrillIn
      isLoading={isLoading}
      ListEmptyComponent={ListEmptyComponent}
    />
  );
}
