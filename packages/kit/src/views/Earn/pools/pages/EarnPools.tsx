import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  ListView,
  SearchBar,
  SizableText,
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
import { EarnPageContainer } from '../../components/EarnPageContainer';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { PoolsDemoMenuButton } from '../components/PoolsDemoMenuButton';
import { PoolListRow } from '../components/PoolsDiscoverList';
import { PoolsListSkeleton } from '../components/PoolsHomeTab';
import { PoolsPhoneFilterBar } from '../components/PoolsPhoneFilterBar';
import { POOLS_COPY } from '../poolsCopy';
import {
  EMPTY_POOLS_FILTER,
  countPanelFilters,
  filterPools,
  getPoolKeySearch,
  getPoolNetworkCounts,
  getPoolsOptionCounts,
  scopePools,
  sortPools,
  withSearchedPools,
} from '../poolsFilter';
import { PoolsQueries, usePoolsQuery } from '../poolsQueries';
import { usePoolFavorites } from '../usePoolFavorites';

import type { IPoolsListSort } from '../components/PoolsFilterButton';
import type { IPoolsFilter } from '../poolsFilter';

const EMPTY_POOLS: IPoolListItem[] = [];

function EarnPoolsContent() {
  const intl = useIntl();
  const tabBarHeight = useScrollContentTabBarOffset();
  const [searchText, setSearchText] = useState('');
  const [chainId, setChainId] = useState<string>();
  const [filter, setFilter] = useState<IPoolsFilter>(EMPTY_POOLS_FILTER);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  // TVL high to low by default (doc §2.3)
  const [sort, setSort] = useState<IPoolsListSort>({
    key: 'tvl',
    direction: 'desc',
  });
  const { favoriteIds } = usePoolFavorites();

  const { result: pools } = usePoolsQuery(PoolsQueries.list());
  // An exact pool address also finds a pool that trades too little for the
  // list; it shows only while that address is in the search box
  const keySearch = getPoolKeySearch(searchText);
  const { result: searchedPools } = usePoolsQuery(
    keySearch ? PoolsQueries.byKey(keySearch) : undefined,
    { keepPrevious: false },
  );

  const networkCounts = useMemo(
    () => getPoolNetworkCounts(pools ?? []),
    [pools],
  );

  // A chain the list no longer has pools on falls back to every chain
  useEffect(() => {
    if (pools && chainId && !networkCounts[chainId]) {
      setChainId(undefined);
    }
  }, [chainId, networkCounts, pools]);

  // New pools count from when the page opened
  const [now] = useState(() => Date.now());
  const scoped = useMemo(
    () =>
      scopePools({
        pools: withSearchedPools(pools, searchedPools) ?? [],
        networkIds: chainId ? [chainId] : [],
        search: searchText,
        onlyIds: favoritesOnly ? favoriteIds : undefined,
      }),
    [chainId, favoriteIds, favoritesOnly, pools, searchText, searchedPools],
  );
  // Phones sort, and read Trending, on the last 24 hours
  const sortedPools = useMemo(
    () =>
      sortPools(
        filterPools({
          pools: scoped,
          filter,
          networkIds: [],
          search: '',
          period: '1D',
          now,
        }),
        sort.key,
        sort.direction,
        '1D',
      ),
    [filter, now, scoped, sort.direction, sort.key],
  );
  const optionCounts = useMemo(
    () => getPoolsOptionCounts({ pools: scoped, filter, period: '1D', now }),
    [filter, now, scoped],
  );

  const renderItem = useCallback(
    ({ item }: { item: IPoolListItem }) => <PoolListRow pool={item} />,
    [],
  );

  const keyExtractor = useCallback((item: IPoolListItem) => item.id, []);

  // Clears what the sheet and the chain pill set; the search and Favorites
  // stay as they are
  const canClearFilters =
    Boolean(chainId) || countPanelFilters(filter, { withCategory: true }) > 0;
  const noFavorites = favoritesOnly && !favoriteIds.size;
  const emptyTitle =
    searchText.trim().length > 0 || canClearFilters
      ? intl.formatMessage({ id: ETranslations.global_search_no_results_title })
      : POOLS_COPY.noPools;

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
      <PoolsPhoneFilterBar
        chainId={chainId}
        onChainChange={setChainId}
        networkCounts={networkCounts}
        favoritesOnly={favoritesOnly}
        onFavoritesOnlyChange={setFavoritesOnly}
        filter={filter}
        onFilterChange={setFilter}
        sort={sort}
        onSortChange={setSort}
        resultCount={sortedPools.length}
        optionCounts={optionCounts}
      />
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
              testID="earn-pools-empty"
              icon={noFavorites ? 'StarOutline' : 'SearchOutline'}
              title={noFavorites ? POOLS_COPY.noFavorites : emptyTitle}
              buttonProps={
                !noFavorites && canClearFilters
                  ? {
                      testID: 'earn-pools-empty-clear',
                      variant: 'secondary',
                      children: POOLS_COPY.clearAllFilters,
                      onPress: () => {
                        setFilter({ ...EMPTY_POOLS_FILTER });
                        setChainId(undefined);
                      },
                    }
                  : undefined
              }
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
