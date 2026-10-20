import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  ListView,
  SearchBar,
  SizableText,
  XStack,
  YStack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IPoolListItem } from '@onekeyhq/shared/types/pools';

import {
  EARN_LIST_ESTIMATED_ITEM_SIZE,
  EarnListRowSeparator,
} from '../../components/earnListRhythm';
import { earnListScrollBehaviorProps } from '../../components/earnListScrollProps';
import { EarnMobileSortControl } from '../../components/EarnMobileSortControl';
import { EarnPageContainer } from '../../components/EarnPageContainer';
import { NetworkFilterControl } from '../../components/NetworkFilterControl';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { PoolsDemoMenuButton } from '../components/PoolsDemoMenuButton';
import { PoolListRow, PoolsScopeChips } from '../components/PoolsDiscoverList';
import { PoolsFilterButton } from '../components/PoolsFilterButton';
import { PoolsListSkeleton } from '../components/PoolsHomeTab';
import { POOLS_COPY } from '../poolsCopy';
import {
  EMPTY_POOLS_FILTER,
  filterPools,
  getPoolNetworkCounts,
  sortPools,
} from '../poolsFilter';
import { PoolsQueries, usePoolsQuery } from '../poolsQueries';
import { usePoolFavorites } from '../usePoolFavorites';

import type {
  IEarnSortDirection,
  IEarnSortOption,
} from '../../components/EarnMobileSortControl';
import type { IPoolsScope } from '../components/PoolsDiscoverList';
import type { IPoolsFilter, IPoolsSortKey } from '../poolsFilter';

const EMPTY_POOLS: IPoolListItem[] = [];

function EarnPoolsContent() {
  const intl = useIntl();
  const tabBarHeight = useScrollContentTabBarOffset();
  const [searchText, setSearchText] = useState('');
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<IPoolsFilter>(EMPTY_POOLS_FILTER);
  const [scope, setScope] = useState<IPoolsScope>('all');
  // TVL high to low by default (doc §2.3)
  const [sortKey, setSortKey] = useState<IPoolsSortKey>('tvl');
  const [sortDirection, setSortDirection] =
    useState<IEarnSortDirection>('desc');
  const { favoriteIds } = usePoolFavorites();

  const { result: pools } = usePoolsQuery(PoolsQueries.list());

  const networkCounts = useMemo(
    () => getPoolNetworkCounts(pools ?? []),
    [pools],
  );
  const availableNetworkIds = useMemo(
    () => Object.keys(networkCounts),
    [networkCounts],
  );

  useEffect(() => {
    setSelectedNetworkIds((prev) => {
      const next = prev.filter((id) => availableNetworkIds.includes(id));
      return next.length === prev.length ? prev : next;
    });
  }, [availableNetworkIds]);

  // Phones sort on the last 24 hours
  const sortedPools = useMemo(
    () =>
      sortPools(
        filterPools({
          pools: pools ?? [],
          filter: { ...filter, stocksOnly: scope === 'stocks' },
          networkIds: selectedNetworkIds,
          search: searchText,
          onlyIds: scope === 'favorites' ? favoriteIds : undefined,
        }),
        sortKey,
        sortDirection,
        '1D',
      ),
    [
      favoriteIds,
      filter,
      pools,
      scope,
      searchText,
      selectedNetworkIds,
      sortDirection,
      sortKey,
    ],
  );

  const sortOptions = useMemo<IEarnSortOption[]>(() => {
    const highToLow = intl.formatMessage({
      id: ETranslations.high_to_low__action,
    });
    const lowToHigh = intl.formatMessage({
      id: ETranslations.low_to_high__action,
    });
    return [
      {
        label: `${POOLS_COPY.sortTvl} ${highToLow}`,
        triggerLabel: POOLS_COPY.sortTvl,
        value: 'tvl',
        direction: 'desc',
      },
      {
        label: `${POOLS_COPY.sortApr} ${highToLow}`,
        triggerLabel: POOLS_COPY.sortApr,
        value: 'apr',
        direction: 'desc',
      },
      {
        label: `${POOLS_COPY.sortVolume} ${highToLow}`,
        triggerLabel: POOLS_COPY.sortVolume,
        value: 'volume',
        direction: 'desc',
      },
      {
        label: `${POOLS_COPY.sortFees} ${highToLow}`,
        triggerLabel: POOLS_COPY.sortFees,
        value: 'fees',
        direction: 'desc',
      },
      {
        label: `${POOLS_COPY.sortTvl} ${lowToHigh}`,
        triggerLabel: POOLS_COPY.sortTvl,
        value: 'tvl',
        direction: 'asc',
      },
      {
        label: `${POOLS_COPY.sortApr} ${lowToHigh}`,
        triggerLabel: POOLS_COPY.sortApr,
        value: 'apr',
        direction: 'asc',
      },
    ];
  }, [intl]);

  const handleSortChange = useCallback(
    (key: string, direction: IEarnSortDirection) => {
      setSortKey(key as IPoolsSortKey);
      setSortDirection(direction);
    },
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: IPoolListItem }) => <PoolListRow pool={item} />,
    [],
  );

  const keyExtractor = useCallback((item: IPoolListItem) => item.id, []);

  const isFiltered =
    searchText.trim().length > 0 ||
    selectedNetworkIds.length > 0 ||
    filter !== EMPTY_POOLS_FILTER ||
    scope === 'stocks';

  let emptyTitle: string = POOLS_COPY.noPools;
  if (scope === 'favorites' && !favoriteIds.size) {
    emptyTitle = POOLS_COPY.noFavorites;
  } else if (isFiltered) {
    emptyTitle = intl.formatMessage({
      id: ETranslations.global_search_no_results_title,
    });
  }

  const listHeader = (
    <>
      <YStack px="$pagePadding" pb="$2">
        <SearchBar
          testID="earn-pools-search"
          value={searchText}
          onChangeText={setSearchText}
          placeholder={intl.formatMessage({ id: ETranslations.global_search })}
        />
      </YStack>
      <XStack px="$pagePadding" py="$2" ai="center" jc="space-between">
        <NetworkFilterControl
          testID="earn-pools-network-filter"
          variant="compact"
          availableNetworkIds={availableNetworkIds}
          selectedNetworkIds={selectedNetworkIds}
          networkAssetCounts={networkCounts}
          onSelectionChange={setSelectedNetworkIds}
        />
        <EarnMobileSortControl
          sortKey={sortKey}
          sortDirection={sortDirection}
          options={sortOptions}
          onSortChange={handleSortChange}
          compact
          testID="earn-pools-sort"
        />
      </XStack>
      <XStack px="$pagePadding" py="$2" gap="$2" ai="center">
        <PoolsScopeChips scope={scope} onChange={setScope} />
        <YStack flex={1} />
        <PoolsFilterButton
          testID="earn-pools-filter"
          value={filter}
          onChange={setFilter}
        />
      </XStack>
    </>
  );

  return (
    <EarnPageContainer
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      pageTitle={
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.global_pools })}
        </SizableText>
      }
      showBackButton
      customHeaderRightItems={<PoolsDemoMenuButton />}
      bodyListMode
    >
      <ListView
        flex={1}
        {...earnListScrollBehaviorProps}
        data={pools ? sortedPools : EMPTY_POOLS}
        estimatedItemSize={EARN_LIST_ESTIMATED_ITEM_SIZE}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={EarnListRowSeparator}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          pools ? (
            <Empty
              icon={
                scope === 'favorites' && !favoriteIds.size
                  ? 'StarOutline'
                  : 'SearchOutline'
              }
              title={emptyTitle}
            />
          ) : (
            <PoolsListSkeleton rows={8} />
          )
        }
        contentContainerStyle={{ pb: tabBarHeight }}
      />
    </EarnPageContainer>
  );
}

export default function EarnPools() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <EarnPoolsContent />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
