import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  ListView,
  SearchBar,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabEarnRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IPoolListItem,
  IPoolListSortKey,
} from '@onekeyhq/shared/types/pools';

import {
  EARN_LIST_ESTIMATED_ITEM_SIZE,
  EARN_LIST_ROW_GAP,
  EarnListRowSeparator,
} from '../../components/earnListRhythm';
import { earnListScrollBehaviorProps } from '../../components/earnListScrollProps';
import { EarnMobileSortControl } from '../../components/EarnMobileSortControl';
import { EarnPageContainer } from '../../components/EarnPageContainer';
import { NetworkFilterControl } from '../../components/NetworkFilterControl';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { PoolListItem } from '../components/PoolListItem';
import { PoolsDemoMenuButton } from '../components/PoolsDemoMenuButton';
import { PoolsChip, PoolsFilterButton } from '../components/PoolsFilterButton';
import { POOLS_COPY } from '../poolsCopy';
import {
  EMPTY_POOLS_FILTER,
  filterPools,
  getPoolNetworkCounts,
} from '../poolsFilter';

import type {
  IEarnSortDirection,
  IEarnSortOption,
} from '../../components/EarnMobileSortControl';
import type { IPoolsFilter } from '../poolsFilter';

const EMPTY_POOLS: IPoolListItem[] = [];

function sortValue(pool: IPoolListItem, key: IPoolListSortKey) {
  if (key === 'apr') {
    return Number(pool.feeApr ?? 0);
  }
  if (key === 'volume24h') {
    return Number(pool.volume24hUsd);
  }
  return Number(pool.tvlUsd);
}

function EarnPoolsSkeleton() {
  return (
    <YStack px="$pagePadding" gap={EARN_LIST_ROW_GAP}>
      {Array.from({ length: 8 }).map((_, index) => (
        <XStack key={index} minHeight="$11" py="$2" ai="center" gap="$3">
          <Skeleton w="$16" h="$10" borderRadius="$full" />
          <YStack flex={1} gap="$1.5">
            <Skeleton h="$4" w="$28" />
            <Skeleton h="$3" w="$20" />
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

function EarnPoolsContent() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const tabBarHeight = useScrollContentTabBarOffset();
  const [searchText, setSearchText] = useState('');
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<IPoolsFilter>(EMPTY_POOLS_FILTER);
  // TVL high to low by default (doc §2.3)
  const [sortKey, setSortKey] = useState<IPoolListSortKey>('tvl');
  const [sortDirection, setSortDirection] =
    useState<IEarnSortDirection>('desc');

  const { result: pools, isLoading } = usePromiseResult(
    () => backgroundApiProxy.servicePools.getPoolList(),
    [],
    { watchLoading: true },
  );

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

  const sortedPools = useMemo(
    () =>
      filterPools({
        pools: pools ?? [],
        filter,
        networkIds: selectedNetworkIds,
        search: searchText,
      }).toSorted((a, b) => {
        const diff = sortValue(a, sortKey) - sortValue(b, sortKey);
        return sortDirection === 'asc' ? diff : -diff;
      }),
    [filter, pools, searchText, selectedNetworkIds, sortDirection, sortKey],
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
        value: 'volume24h',
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
      setSortKey(key as IPoolListSortKey);
      setSortDirection(direction);
    },
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: IPoolListItem }) => (
      <PoolListItem
        pool={item}
        testID={`earn-pools-item-${item.id}`}
        onPress={() =>
          navigation.push(ETabEarnRoutes.EarnPoolDetails, { poolId: item.id })
        }
      />
    ),
    [navigation],
  );

  const keyExtractor = useCallback((item: IPoolListItem) => item.id, []);

  const isFiltered =
    searchText.trim().length > 0 ||
    selectedNetworkIds.length > 0 ||
    filter !== EMPTY_POOLS_FILTER;

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
        <PoolsChip
          label={POOLS_COPY.allPools}
          active={!filter.stocksOnly}
          onPress={() => setFilter({ ...filter, stocksOnly: false })}
        />
        <PoolsChip
          label={POOLS_COPY.stocks}
          active={filter.stocksOnly}
          onPress={() => setFilter({ ...filter, stocksOnly: true })}
        />
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
        data={isLoading && !pools ? EMPTY_POOLS : sortedPools}
        estimatedItemSize={EARN_LIST_ESTIMATED_ITEM_SIZE}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={EarnListRowSeparator}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          isLoading && !pools ? (
            <EarnPoolsSkeleton />
          ) : (
            <Empty
              icon="SearchOutline"
              title={
                isFiltered
                  ? intl.formatMessage({
                      id: ETranslations.global_search_no_results_title,
                    })
                  : POOLS_COPY.noPools
              }
            />
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
