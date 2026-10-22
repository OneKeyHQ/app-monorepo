import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  IconButton,
  SearchBar,
  Select,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { SortableListView } from '@onekeyhq/components/src/layouts/SortableListView';
import type {
  IDragEndParamsWithItem,
  IRenderItemParams,
} from '@onekeyhq/components/src/layouts/SortableListView/types';
import {
  useMarketWatchListV2Atom,
  useWatchListV2Actions,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { usePerpsNavigation } from '@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import {
  MARKET_HOME_WS_MAX_SUBSCRIPTIONS,
  useMarketHomeTokenListWebSocket,
} from '../../../MarketHomeV2/components/MarketTokenList/hooks/useMarketHomeTokenListWebSocket';
import { useMarketWatchlistTokenList } from '../../../MarketHomeV2/components/MarketTokenList/hooks/useMarketWatchlistTokenList';
import { useToDetailPage } from '../../../MarketHomeV2/components/MarketTokenList/hooks/useToMarketDetailPage';
import { useWatchlistFilteredGroups } from '../../../MarketHomeV2/components/MarketTokenList/hooks/useWatchlistFilteredGroups';
import { getMarketWatchlistRowKind } from '../../../MarketHomeV2/components/MarketTokenList/utils/marketWatchlistRowKind';
import { useMarketHomeSelection } from '../../../MarketHomeV2/hooks/useMarketHomeSelection';
import { useMarketDetailWatchlistIdentity } from '../../hooks/useMarketDetailWatchlistIdentity';
import { useTokenDetail } from '../../hooks/useTokenDetail';
import {
  TOKEN_SELECTOR_POLLING_INTERVAL,
  TOKEN_SELECTOR_TABLE_PADDING,
} from '../TokenSelector/constants';
import { SelectorWatchlistRecommendations } from '../TokenSelector/SelectorWatchlistRecommendations';

import {
  filterWatchlistTokens,
  getWatchlistSidebarPriceChange,
} from './filterWatchlistTokens';
import {
  WATCHLIST_SIDEBAR_ROW_HEIGHT,
  WatchlistSidebarRow,
  WatchlistSidebarRowSkeleton,
} from './WatchlistSidebarRow';

import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';
import type { IWatchlistFilterType } from '../../../MarketHomeV2/components/MarketTokenList/MarketWatchlistCategorySelector';

// A 304px column whose 1px right divider is part of it.
export const MARKET_DETAIL_WATCHLIST_SIDEBAR_WIDTH = 304;

// The divider stops 24px short of the top and bottom edges.
const SIDEBAR_DIVIDER_INSET = 24;

// The filter menu only holds four short labels and a check mark.
const FILTER_MENU_WIDTH = 160;

// The detail headers start 20px down and center a 28px symbol over a 20px name
// in their 72px row, so the symbol line is centered 46px from the top. Lifting
// the 24px title line to that center lines "Favorites" up with the symbol.
const SIDEBAR_TITLE_TOP_PADDING = 34;

type ISidebarFilter = IWatchlistFilterType;
type ISidebarSortOrder = 'asc' | 'desc';
type ISidebarSortKey = 'volume' | 'change';
interface ISidebarSort {
  key: ISidebarSortKey;
  order: ISidebarSortOrder;
}

const FILTER_LABELS: Record<ISidebarFilter, ETranslations> = {
  all: ETranslations.global_all,
  spot: ETranslations.prime_crypto_payment__label,
  stocks: ETranslations.perps_token_selector_stocks,
  perps: ETranslations.global_perp,
};

const FILTER_ORDER: ISidebarFilter[] = ['all', 'spot', 'stocks', 'perps'];

const SIDEBAR_SKELETON_COUNT = 8;

const keyExtractor = (item: IMarketToken) => item.id;

// The web sortable list positions rows from a fixed row height.
const getItemLayout = (
  _: ArrayLike<IMarketToken> | null | undefined,
  index: number,
) => ({
  length: WATCHLIST_SIDEBAR_ROW_HEIGHT,
  offset: WATCHLIST_SIDEBAR_ROW_HEIGHT * index,
  index,
});

function toWatchListItem(token: IMarketToken): IMarketWatchListItemV2 {
  return {
    chainId: token.networkId,
    contractAddress: token.address,
    sortIndex: token.sortIndex,
    isNative: token.isNative,
    perpsCoin: token.perpsCoin,
    assetId: token.assetId,
    stockId: token.stockId,
  };
}

function getSortValue(item: IMarketToken, key: ISidebarSortKey) {
  if (key === 'change') {
    return getWatchlistSidebarPriceChange(item);
  }
  // A stock listing bundles several tokenized variants and reports the shares'
  // own trading, so it has no on-chain volume to rank against tokens.
  if (getMarketWatchlistRowKind(item) === 'stock') {
    return undefined;
  }
  return Number.isFinite(item.turnover) && item.turnover
    ? item.turnover
    : undefined;
}

// Rows missing the sorted figure (unset, or NaN from an unavailable quote)
// stay at the bottom either way; no sort keeps the watchlist's own order.
function sortTokens(tokens: IMarketToken[], sort: ISidebarSort | undefined) {
  if (!sort) {
    return tokens;
  }
  const direction = sort.order === 'desc' ? -1 : 1;
  return tokens.toSorted((a, b) => {
    const valueA = getSortValue(a, sort.key);
    const valueB = getSortValue(b, sort.key);
    if (valueA === undefined || valueB === undefined) {
      return Number(valueA === undefined) - Number(valueB === undefined);
    }
    return (valueA - valueB) * direction;
  });
}

// Each column cycles descending, ascending, then off; switching columns
// starts the new one descending.
function nextSort(
  sort: ISidebarSort | undefined,
  key: ISidebarSortKey,
): ISidebarSort | undefined {
  if (sort?.key !== key) {
    return { key, order: 'desc' };
  }
  return sort.order === 'desc' ? { key, order: 'asc' } : undefined;
}

function isCurrentDetailToken(
  item: IMarketToken,
  current: {
    stockId?: string;
    assetId?: string;
    networkId?: string;
    tokenAddress?: string;
  },
) {
  if (current.stockId) {
    return item.stockId?.toUpperCase() === current.stockId.toUpperCase();
  }
  if (current.assetId) {
    return item.assetId === current.assetId;
  }
  // On a token route, a chain row matches by network and address even when it
  // carries a `stockId` (a tokenized stock); listing and asset rows have no
  // network, so they never match here.
  return (
    !item.perpsCoin &&
    Boolean(current.networkId) &&
    item.networkId === current.networkId &&
    item.address.toLowerCase() === (current.tokenAddress ?? '').toLowerCase()
  );
}

function SortIcon({ order }: { order?: ISidebarSortOrder }) {
  let name:
    | 'ChevronGrabberVerOutline'
    | 'ChevronDownSmallOutline'
    | 'ChevronTopSmallOutline' = 'ChevronGrabberVerOutline';
  if (order === 'desc') {
    name = 'ChevronDownSmallOutline';
  } else if (order === 'asc') {
    name = 'ChevronTopSmallOutline';
  }
  return <Icon name={name} color="$iconSubdued" size="$3.5" />;
}

function FilterSelectTrigger({ label }: { label?: string }) {
  return (
    <XStack alignItems="center" gap="$1" cursor="pointer" userSelect="none">
      <SizableText size="$bodyMdMedium" color="$textSubdued">
        {label}
      </SizableText>
      <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$4.5" />
    </XStack>
  );
}

function MarketDetailWatchlistSidebarImpl({
  onClose,
  onNavigate,
  elevated = false,
}: {
  onClose: () => void;
  // Lets the overlay close itself once a row opens another detail page.
  onNavigate?: () => void;
  // The overlay floats the sidebar over the detail content with a shadow.
  elevated?: boolean;
}) {
  const intl = useIntl();
  // Persisted so closing and reopening the sidebar keeps the last filter.
  const [filter, setFilter] = useMarketHomeSelection(
    'detailWatchlistSidebarFilter',
    'all',
  );
  const [searchValue, setSearchValue] = useState('');
  const [sort, setSort] = useState<ISidebarSort | undefined>();
  const { stockId, assetId } = useMarketDetailWatchlistIdentity();
  const { networkId, tokenAddress } = useTokenDetail();

  const [{ data: watchListData, isMounted }] = useMarketWatchListV2Atom();
  const watchListActions = useWatchListV2Actions();
  // Favorites changed elsewhere (home, the header star) reload the list, as
  // the token selector's Favorites tab does.
  useEffect(() => {
    const refresh = async () => {
      await watchListActions.current.refreshWatchListV2();
    };
    appEventBus.on(EAppEventBusNames.RefreshMarketWatchList, refresh);
    appEventBus.on(EAppEventBusNames.MarketWatchListV2Changed, refresh);
    return () => {
      appEventBus.off(EAppEventBusNames.RefreshMarketWatchList, refresh);
      appEventBus.off(EAppEventBusNames.MarketWatchListV2Changed, refresh);
    };
  }, [watchListActions]);
  const { data, isLoading, isError, refetchAll } = useMarketWatchlistTokenList({
    watchlist: watchListData ?? [],
    pageSize: Math.max(watchListData?.length ?? 0, 1),
    pollingInterval: TOKEN_SELECTOR_POLLING_INTERVAL,
  });
  // Live ticks on top of the poll, as the Market Favorites tab gets them: the
  // same subscription hook, only while this detail page is the focused one,
  // and under the same cap. The watchlist has no size limit, so only the first
  // rows the hook can subscribe (chain tokens, not perps or listings) take the
  // slots; the rest stay on the poll.
  const isFocused = useIsFocused();
  const subscriptionTokens = useMemo(
    () =>
      data
        .filter((token) => !token.perpsCoin && Boolean(token.networkId))
        .slice(0, MARKET_HOME_WS_MAX_SUBSCRIPTIONS),
    [data],
  );
  const liveData = useMarketHomeTokenListWebSocket({
    tokens: data,
    subscriptionTokens,
    enabled: isFocused && (platformEnv.isDesktop || platformEnv.isWeb),
  });
  const groups = useWatchlistFilteredGroups(liveData);
  const listData = useMemo(
    () => sortTokens(filterWatchlistTokens(groups[filter], searchValue), sort),
    [groups, filter, searchValue, sort],
  );

  const filterItems = useMemo(
    () =>
      FILTER_ORDER.map((value) => ({
        value,
        label: intl.formatMessage({ id: FILTER_LABELS[value] }),
      })),
    [intl],
  );
  const handleVolumeSortPress = useCallback(
    () => setSort((prev) => nextSort(prev, 'volume')),
    [],
  );
  const handleChangeSortPress = useCallback(
    () => setSort((prev) => nextSort(prev, 'change')),
    [],
  );

  const { navigateToPerps } = usePerpsNavigation();
  const toMarketDetailPage = useToDetailPage({
    replaceCurrentDetail: true,
    resolveMarketAsset: true,
  });
  const handleItemPress = useCallback(
    (item: IMarketToken) => {
      onNavigate?.();
      if (item.perpsCoin) {
        navigateToPerps(item.perpsCoin);
        return;
      }
      void toMarketDetailPage({
        ...item,
        tokenAddress: item.address,
        networkId: item.networkId,
        isNative: item.isNative,
      });
    },
    [navigateToPerps, onNavigate, toMarketDetailPage],
  );

  // Same reorder as the Market Favorites tab, so both lists stay in step: the
  // dragged row takes a sortIndex between its visible neighbors, which leaves
  // the order inside every other category untouched. A column sort or a
  // search shows rows out of their stored order, so dragging waits for both
  // to clear.
  const isDraggable = !sort && !searchValue.trim();
  const handleDragEnd = useCallback(
    ({
      dragItem,
      prevItem,
      nextItem,
    }: IDragEndParamsWithItem<IMarketToken>) => {
      void watchListActions.current.sortWatchListV2Items({
        target: toWatchListItem(dragItem),
        prev: prevItem ? toWatchListItem(prevItem) : undefined,
        next: nextItem ? toWatchListItem(nextItem) : undefined,
      });
    },
    [watchListActions],
  );

  const renderItem = useCallback(
    ({ item, dragProps, isActive }: IRenderItemParams<IMarketToken>) => (
      <Stack px={TOKEN_SELECTOR_TABLE_PADDING}>
        <WatchlistSidebarRow
          item={item}
          isSelected={isCurrentDetailToken(item, {
            stockId,
            assetId,
            networkId,
            tokenAddress,
          })}
          isDragging={isActive}
          dragProps={dragProps}
          onPress={handleItemPress}
        />
      </Stack>
    ),
    [assetId, handleItemPress, networkId, stockId, tokenAddress],
  );

  // Empty means nothing is stored, not nothing loaded: on desktop and web a
  // failed request leaves the hook without rows and without `isError`, so
  // favorites that are stored but came back with no rows read as a failed
  // load rather than an empty watchlist.
  const storedCount = watchListData?.length ?? 0;
  // A search with nothing stored reads as no results, not as recommendations.
  const isWatchlistEmpty =
    isMounted && storedCount === 0 && !searchValue.trim();
  const showSkeleton = !isMounted || (isLoading && data.length === 0);
  const isLoadFailed = data.length === 0 && (isError || storedCount > 0);

  const tableHeader = (
    <XStack
      px="$2.5"
      pt="$2"
      pb="$2"
      alignItems="center"
      justifyContent="space-between"
      cursor="default"
      userSelect="none"
    >
      <XStack
        testID="market-detail-watchlist-sidebar-sort-volume"
        alignItems="center"
        gap="$0.5"
        cursor="pointer"
        onPress={handleVolumeSortPress}
      >
        <SizableText size="$bodySm" color="$textSubdued">
          {`${intl.formatMessage({
            id: ETranslations.global_name,
          })} / ${intl.formatMessage({
            id: ETranslations.market_stock_volume__title,
          })}`}
        </SizableText>
        <SortIcon order={sort?.key === 'volume' ? sort.order : undefined} />
      </XStack>
      <XStack
        testID="market-detail-watchlist-sidebar-sort-change"
        alignItems="center"
        gap="$0.5"
        cursor="pointer"
        onPress={handleChangeSortPress}
      >
        <SortIcon order={sort?.key === 'change' ? sort.order : undefined} />
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.market_stock_change__title })}
        </SizableText>
      </XStack>
    </XStack>
  );

  let content;
  if (isWatchlistEmpty) {
    content = <SelectorWatchlistRecommendations />;
  } else if (showSkeleton) {
    content = (
      <YStack px={TOKEN_SELECTOR_TABLE_PADDING}>
        {tableHeader}
        {Array.from({ length: SIDEBAR_SKELETON_COUNT }, (_, index) => (
          <WatchlistSidebarRowSkeleton key={index} />
        ))}
      </YStack>
    );
  } else if (isLoadFailed) {
    // Without `isError` the empty result may also be favorites that are no
    // longer available (a delisted perp), so it reads as no results with a
    // retry rather than claiming a connection error.
    content = (
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$2">
        <SizableText color="$textSubdued">
          {intl.formatMessage({
            id: isError
              ? ETranslations.global_connet_error_try_again
              : ETranslations.global_no_results,
          })}
        </SizableText>
        <Button
          testID="market-detail-watchlist-sidebar-retry"
          size="small"
          variant="tertiary"
          onPress={() => void refetchAll()}
        >
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      </YStack>
    );
  } else if (listData.length === 0) {
    content = (
      <YStack flex={1} px={TOKEN_SELECTOR_TABLE_PADDING}>
        {tableHeader}
        <YStack flex={1} alignItems="center" justifyContent="center">
          <SizableText color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_no_results })}
          </SizableText>
        </YStack>
      </YStack>
    );
  } else {
    content = (
      <YStack flex={1} minHeight={0}>
        {/* Rows sit absolutely positioned in the sortable list, so the header
            stays above it rather than inside as a list header. */}
        <YStack px={TOKEN_SELECTOR_TABLE_PADDING}>{tableHeader}</YStack>
        <SortableListView
          flex={1}
          data={listData}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          renderItem={renderItem}
          enabled={isDraggable}
          onDragEnd={handleDragEnd}
          contentContainerStyle={{ pb: TOKEN_SELECTOR_TABLE_PADDING }}
        />
      </YStack>
    );
  }

  return (
    <YStack
      testID="market-detail-watchlist-sidebar"
      width={MARKET_DETAIL_WATCHLIST_SIDEBAR_WIDTH}
      height="100%"
      bg="$bgApp"
      position="relative"
      {...(elevated && {
        shadowColor: 'black',
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      })}
    >
      {/* The floating overlay is set apart by its shadow, so only the docked
          sidebar draws the divider. */}
      {elevated ? null : (
        <Stack
          position="absolute"
          right={0}
          top={SIDEBAR_DIVIDER_INSET}
          bottom={SIDEBAR_DIVIDER_INSET}
          width={1}
          bg="$borderSubdued"
          pointerEvents="none"
        />
      )}
      <XStack
        px="$5"
        pt={SIDEBAR_TITLE_TOP_PADDING}
        alignItems="center"
        gap="$2.5"
      >
        <XStack flex={1} minWidth={0} alignItems="center" gap="$4">
          <SizableText size="$headingMd" numberOfLines={1}>
            {intl.formatMessage({ id: ETranslations.global_favorites })}
          </SizableText>
          <Select
            testID="market-detail-watchlist-sidebar-filter"
            title={intl.formatMessage({ id: ETranslations.global_favorites })}
            items={filterItems}
            value={filter}
            onChange={setFilter}
            placement="bottom-start"
            floatingPanelProps={{ width: FILTER_MENU_WIDTH }}
            renderTrigger={FilterSelectTrigger}
          />
        </XStack>
        <IconButton
          testID="market-detail-watchlist-sidebar-close"
          icon="CrossedSmallOutline"
          variant="tertiary"
          size="small"
          onPress={onClose}
        />
      </XStack>
      <XStack px="$5" pt="$4" pb="$2">
        <SearchBar
          testID="market-detail-watchlist-sidebar-search"
          size="small"
          containerProps={{ flex: 1 }}
          placeholder={intl.formatMessage({
            id: ETranslations.global_search,
          })}
          value={searchValue}
          onChangeText={setSearchValue}
        />
      </XStack>
      <YStack flex={1} minHeight={0}>
        {content}
      </YStack>
    </YStack>
  );
}

export const MarketDetailWatchlistSidebar = memo(
  MarketDetailWatchlistSidebarImpl,
);
