import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  Empty,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type {
  IPoolListItem,
  IPoolStatsWindow,
} from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import { filterPools, sortPools } from '../poolsFilter';
import { usePoolFavorites } from '../usePoolFavorites';

import {
  PoolListRow,
  PoolsDiscoverTable,
  PoolsPeriodPills,
  PoolsScopeChips,
  useExpandedPool,
} from './PoolsDiscoverList';

import type { IPoolsScope } from './PoolsDiscoverList';
import type { IPoolsFilter, IPoolsSortKey } from '../poolsFilter';

export function PoolsListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <YStack px="$5" gap="$3" py="$2">
      {Array.from({ length: rows }).map((_, index) => (
        <XStack key={index} minHeight="$12" ai="center" gap="$3">
          <Skeleton w="$16" h="$10" borderRadius="$full" />
          <YStack flex={1} gap="$1.5">
            <Skeleton h="$4" w="$28" />
            <Skeleton h="$4" w="$36" />
          </YStack>
          <YStack ai="flex-end" gap="$1.5">
            <Skeleton h="$4" w="$20" />
            <Skeleton h="$3" w="$16" />
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}

/**
 * The Pools pill on the Earn home. Wide screens get the table with its
 * period; phones get rows that open into tabs.
 */
export function PoolsHomeTab({
  pools,
  filter,
  networkIds,
  search,
  emptyComponent,
}: {
  pools: IPoolListItem[] | undefined;
  filter: IPoolsFilter;
  networkIds: string[];
  search: string;
  /** Shown when search or filters leave nothing */
  emptyComponent?: ReactNode;
}) {
  const { gtMd } = useMedia();
  const [scope, setScope] = useState<IPoolsScope>('all');
  const [period, setPeriod] = useState<IPoolStatsWindow>('1D');
  const [sort, setSort] = useState<{
    key: IPoolsSortKey;
    direction: 'asc' | 'desc';
  }>({ key: 'tvl', direction: 'desc' });
  const { favoriteIds } = usePoolFavorites();
  const { expandedId, toggle } = useExpandedPool();

  const shownPeriod = gtMd ? period : '1D';
  const shown = useMemo(
    () =>
      sortPools(
        filterPools({
          pools: pools ?? [],
          filter: { ...filter, stocksOnly: scope === 'stocks' },
          networkIds,
          search,
          onlyIds: scope === 'favorites' ? favoriteIds : undefined,
        }),
        sort.key,
        sort.direction,
        shownPeriod,
      ),
    [
      favoriteIds,
      filter,
      networkIds,
      pools,
      scope,
      search,
      shownPeriod,
      sort.direction,
      sort.key,
    ],
  );

  let empty: ReactNode = null;
  if (!pools) {
    empty = <PoolsListSkeleton />;
  } else if (scope === 'favorites' && !favoriteIds.size) {
    empty = <Empty icon="StarOutline" title={POOLS_COPY.noFavorites} />;
  } else {
    empty = emptyComponent ?? (
      <Empty icon="SearchOutline" title={POOLS_COPY.noPools} />
    );
  }

  return (
    <YStack gap="$2">
      <XStack px="$5" pb="$1" ai="center" jc="space-between" gap="$3">
        <PoolsScopeChips scope={scope} onChange={setScope} />
        {gtMd ? (
          <PoolsPeriodPills period={period} onChange={setPeriod} />
        ) : null}
      </XStack>
      {gtMd ? (
        <PoolsDiscoverTable
          pools={shown}
          period={period}
          sortKey={sort.key}
          sortDirection={sort.direction}
          onSortChange={(key, direction) => setSort({ key, direction })}
          expandedId={expandedId}
          onToggle={toggle}
          empty={empty}
        />
      ) : (
        <YStack>
          {shown.length
            ? shown.map((pool) => <PoolListRow key={pool.id} pool={pool} />)
            : empty}
        </YStack>
      )}
    </YStack>
  );
}
