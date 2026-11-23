import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IPoolListItem,
  IPoolStatsWindow,
} from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import {
  EMPTY_POOLS_FILTER,
  countPanelFilters,
  filterPools,
  getPoolKeySearch,
  getPoolsOptionCounts,
  scopePools,
  sortPools,
  withSearchedPools,
} from '../poolsFilter';
import { PoolsQueries, usePoolsQuery } from '../poolsQueries';
import { usePoolFavorites } from '../usePoolFavorites';

import { getPoolPairIconWidth } from './PoolPairIcon';
import {
  PoolListRow,
  PoolsDiscoverTable,
  PoolsPeriodPills,
  PoolsScopeChips,
  getScopeCategory,
  useExpandedPool,
} from './PoolsDiscoverList';
import { PoolsPhoneFilterBar } from './PoolsPhoneFilterBar';

import type { IPoolsScope } from './PoolsDiscoverList';
import type { IPoolsListSort } from './PoolsFilterButton';
import type { IPoolsFilter, IPoolsOptionCounts } from '../poolsFilter';

export function PoolsListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <YStack px="$5" gap="$3" py="$2">
      {Array.from({ length: rows }).map((_, index) => (
        <XStack key={index} minHeight="$12" ai="center" gap="$3">
          <Skeleton w={getPoolPairIconWidth()} h="$8" borderRadius="$full" />
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
 * period; phones get rows under one filter row.
 */
export function PoolsHomeTab({
  pools,
  filter,
  onFilterChange,
  chainId,
  onChainChange,
  networkCounts,
  search,
  onOptionCountsChange,
}: {
  pools: IPoolListItem[] | undefined;
  filter: IPoolsFilter;
  onFilterChange: (filter: IPoolsFilter) => void;
  /** The chain the list shows; absent for every chain */
  chainId?: string;
  onChainChange: (networkId: string | undefined) => void;
  /** Pools per chain, for the chain pill on phones */
  networkCounts: Record<string, number>;
  search: string;
  /** For the Filters button in the toolbar above, on wide screens */
  onOptionCountsChange?: (counts: IPoolsOptionCounts) => void;
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const [scope, setScope] = useState<IPoolsScope>('all');
  const [period, setPeriod] = useState<IPoolStatsWindow>('1D');
  const [sort, setSort] = useState<IPoolsListSort>({
    key: 'tvl',
    direction: 'desc',
  });
  const { favoriteIds } = usePoolFavorites();
  const { expandedId, toggle } = useExpandedPool();
  // An exact pool address also finds a pool that trades too little for the
  // list; it shows only while that address is in the search box
  const keySearch = getPoolKeySearch(search);
  const { result: searchedPools } = usePoolsQuery(
    keySearch ? PoolsQueries.byKey(keySearch) : undefined,
    { keepPrevious: false },
  );

  // New pools count from when the list opened
  const [now] = useState(() => Date.now());
  const shownPeriod = gtMd ? period : '1D';
  const listPools = useMemo(
    () => withSearchedPools(pools, searchedPools) ?? [],
    [pools, searchedPools],
  );
  const networkIds = useMemo(() => (chainId ? [chainId] : []), [chainId]);
  // Each width filters by the types it shows: the row's chips on wide
  // screens, the Filters sheet on phones
  const category = gtMd ? getScopeCategory(scope) : filter.category;
  const shownFilter = useMemo(
    () => ({ ...filter, category }),
    [category, filter],
  );
  const everyPool = useMemo(
    () => scopePools({ pools: listPools, networkIds, search }),
    [listPools, networkIds, search],
  );
  const scoped = useMemo(
    () =>
      scope === 'favorites'
        ? scopePools({
            pools: everyPool,
            networkIds: [],
            search: '',
            onlyIds: favoriteIds,
          })
        : everyPool,
    [everyPool, favoriteIds, scope],
  );
  const shown = useMemo(
    () =>
      sortPools(
        filterPools({
          pools: scoped,
          filter: shownFilter,
          networkIds: [],
          search: '',
          period: shownPeriod,
          now,
        }),
        sort.key,
        sort.direction,
        shownPeriod,
      ),
    [now, scoped, shownFilter, shownPeriod, sort.direction, sort.key],
  );
  const optionCounts = useMemo(
    () =>
      getPoolsOptionCounts({
        pools: scoped,
        filter: shownFilter,
        period: shownPeriod,
        now,
      }),
    [now, scoped, shownFilter, shownPeriod],
  );
  // A type on the wide row replaces Favorites, so it counts every pool
  const rowCategoryCounts = useMemo(
    () =>
      gtMd
        ? getPoolsOptionCounts({
            pools: everyPool,
            filter: shownFilter,
            period: shownPeriod,
            now,
          }).category
        : undefined,
    [everyPool, gtMd, now, shownFilter, shownPeriod],
  );
  useEffect(() => {
    onOptionCountsChange?.(optionCounts);
  }, [onOptionCountsChange, optionCounts]);

  // Everything that narrows the list but the search, which stays as typed.
  // Favorites is where the user is looking, not a filter, so it stays too.
  const canClearFilters =
    Boolean(chainId) ||
    countPanelFilters(filter, { withCategory: !gtMd }) > 0 ||
    Boolean(category && gtMd);
  const clearFilters = () => {
    onFilterChange({ ...EMPTY_POOLS_FILTER });
    onChainChange(undefined);
    setScope((current) => (current === 'favorites' ? current : 'all'));
  };

  let empty: ReactNode = null;
  if (!pools) {
    empty = <PoolsListSkeleton />;
  } else if (scope === 'favorites' && !favoriteIds.size) {
    empty = <Empty icon="StarOutline" title={POOLS_COPY.noFavorites} />;
  } else {
    empty = (
      <Empty
        testID="earn-pools-empty"
        icon="SearchOutline"
        title={
          search || canClearFilters
            ? intl.formatMessage({
                id: ETranslations.global_search_no_results_title,
              })
            : POOLS_COPY.noPools
        }
        buttonProps={
          canClearFilters
            ? {
                testID: 'earn-pools-empty-clear',
                // The Filters sheet's Clear is secondary too
                variant: 'secondary',
                children: POOLS_COPY.clearAllFilters,
                onPress: clearFilters,
              }
            : undefined
        }
      />
    );
  }

  return (
    <YStack gap="$2">
      {gtMd ? (
        <XStack px="$5" pb="$1" ai="center" jc="space-between" gap="$3">
          <PoolsScopeChips
            scope={scope}
            onChange={setScope}
            categoryCounts={rowCategoryCounts}
          />
          <PoolsPeriodPills period={period} onChange={setPeriod} />
        </XStack>
      ) : (
        <PoolsPhoneFilterBar
          // Under the Earn tabs where Fixed Income has its sort row
          pt="$0"
          chainId={chainId}
          onChainChange={onChainChange}
          networkCounts={networkCounts}
          favoritesOnly={scope === 'favorites'}
          onFavoritesOnlyChange={(on) => setScope(on ? 'favorites' : 'all')}
          filter={filter}
          onFilterChange={onFilterChange}
          sort={sort}
          onSortChange={setSort}
          resultCount={shown.length}
          optionCounts={optionCounts}
        />
      )}
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
