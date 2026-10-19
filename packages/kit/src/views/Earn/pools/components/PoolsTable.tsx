import { useCallback, useMemo } from 'react';
import type { ComponentProps } from 'react';

import { SizableText, XStack, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TableList } from '@onekeyhq/kit/src/components/ListView/TableList';
import type { ITableColumn } from '@onekeyhq/kit/src/components/ListView/TableList';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IPoolListItem } from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import { formatCompactUsd, formatPercent } from '../poolsFormat';

import { PoolListItem, PoolNameCell } from './PoolListItem';
import { PoolPairIcon } from './PoolPairIcon';

// The table re-renders on data, not on column closures, so the network's
// name rides in the row
type IPoolTableRow = IPoolListItem & { networkName: string };

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
  const networkIdsKey = useMemo(
    () => Array.from(new Set(pools.map((pool) => pool.networkId))).join(','),
    [pools],
  );
  const { result: networkNames } = usePromiseResult(async () => {
    const { networks } =
      await backgroundApiProxy.serviceNetwork.getNetworksByIds({
        networkIds: networkIdsKey.split(','),
      });
    return new Map(networks.map((network) => [network.id, network.name]));
  }, [networkIdsKey]);
  const rows = useMemo<IPoolTableRow[]>(
    () =>
      pools.map((pool) => ({
        ...pool,
        networkName: networkNames?.get(pool.networkId) ?? '',
      })),
    [networkNames, pools],
  );

  const columns = useMemo<ITableColumn<IPoolTableRow>[]>(
    () => [
      {
        key: 'pool',
        label: POOLS_COPY.pool,
        flex: 2.6,
        render: (pool) => (
          <XStack ai="center" gap="$3" minWidth={0}>
            <PoolPairIcon pool={pool} size="md" />
            <PoolNameCell pool={pool} />
          </XStack>
        ),
      },
      {
        key: 'network',
        label: POOLS_COPY.network,
        flex: 0.8,
        hideInMobile: true,
        render: (pool) => (
          <XStack ai="center" gap="$2" minWidth={0}>
            <NetworkAvatar networkId={pool.networkId} size="$5" />
            <SizableText size="$bodyMd" numberOfLines={1}>
              {pool.networkName}
            </SizableText>
          </XStack>
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
        // The pool's average; the add page estimates the user's own
        label: POOLS_COPY.poolApr,
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

  const keyExtractor = useCallback((pool: IPoolTableRow) => pool.id, []);

  const mobileRenderItem = useCallback(
    (pool: IPoolTableRow) => (
      <PoolListItem pool={pool} onPress={() => onPressPool(pool)} />
    ),
    [onPressPool],
  );

  return (
    <TableList<IPoolTableRow>
      data={rows}
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
