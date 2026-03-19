import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  ListEndIndicator,
  SizableText,
  Spinner,
  Stack,
  Table,
  YStack,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import type { ETableSortType, ITableColumn } from '@onekeyhq/components';
import type { IDragEndParamsWithItem } from '@onekeyhq/components/src/layouts/SortableListView/types';
import { usePerpsNavigation } from '@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  ECopyFrom,
  EWatchlistFrom,
} from '@onekeyhq/shared/src/logger/scopes/dex';
import { ESortWay } from '@onekeyhq/shared/src/logger/scopes/dex/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { DesktopStickyHeaderContext } from '../../layouts/DesktopStickyHeaderContext';
import { StickyHeaderPortal } from '../StickyHeaderPortal';

import { useMarketTokenColumns } from './hooks/useMarketTokenColumns';
import { useToDetailPage } from './hooks/useToMarketDetailPage';
import { type IMarketToken } from './MarketTokenData';

const SPINNER_HEIGHT = 52;
// Watchlist mode: only these 3 columns are sortable (server-side sort)
const SORTABLE_COLUMNS = {
  liquidity: 'liquidity',
  marketCap: 'mc',
  turnover: 'v24hUSD',
} as const;

// Client sort mode: all numeric columns are sortable (client-side sort)
const CLIENT_SORTABLE_COLUMNS: Record<string, string> = {
  ...SORTABLE_COLUMNS,
  price: 'price',
  change24h: 'change24h',
  transactions: 'transactions',
  uniqueTraders: 'uniqueTraders',
  holders: 'holders',
};

// Sort key → IMarketToken field mapping for client-side sorting
const CLIENT_SORT_FIELD_MAP: Record<string, keyof IMarketToken> = {
  price: 'price',
  change24h: 'change24h',
  mc: 'marketCap',
  liquidity: 'liquidity',
  v24hUSD: 'turnover',
  transactions: 'transactions',
  uniqueTraders: 'uniqueTraders',
  holders: 'holders',
};

// Map sort keys to ESortWay enum values for logging
const SORT_KEY_TO_ENUM: Record<string, ESortWay> = {
  liquidity: ESortWay.Liquidity,
  mc: ESortWay.MC,
  v24hUSD: ESortWay.Volume,
};

export type IMarketTokenListResult = {
  data: IMarketToken[];
  isLoading: boolean | undefined;
  isLoadingMore?: boolean;
  isNetworkSwitching?: boolean;
  canLoadMore?: boolean;
  loadMore?: () => void | Promise<void>;
  setSortBy: (sortBy: string | undefined) => void;
  setSortType: (sortType: 'asc' | 'desc' | undefined) => void;
  initialSortBy?: string;
  initialSortType?: 'asc' | 'desc';
  currentSortBy?: string;
  currentSortType?: 'asc' | 'desc';
};

type IMarketTokenListBaseProps = {
  networkId?: string;
  onItemPress?: (item: IMarketToken) => void;
  toolbar?: ReactNode;
  result: IMarketTokenListResult;
  isWatchlistMode?: boolean;
  clientSort?: boolean;
  showEndReachedIndicator?: boolean;
  hideTokenAge?: boolean;
  watchlistFrom?: EWatchlistFrom;
  copyFrom?: ECopyFrom;
  draggable?: boolean;
  showTableHeader?: boolean;
  tabIntegrated?: boolean;
  tabName?: string;
  listContainerProps?: {
    paddingBottom: number;
  };
  onDragEnd?: (params: IDragEndParamsWithItem<IMarketToken>) => void;
  onItemLongPress?: (item: IMarketToken, index: number) => void;
  onItemContextMenu?: (
    item: IMarketToken,
    index: number,
    position?: { x: number; y: number },
  ) => void;
  onScrollBegin?: () => void;
};

function MarketTokenListBase({
  networkId = 'sol--101',
  onItemPress,
  toolbar,
  result,
  isWatchlistMode = false,
  clientSort = false,
  showEndReachedIndicator = false,
  hideTokenAge = false,
  watchlistFrom,
  copyFrom,
  draggable = false,
  showTableHeader = true,
  tabIntegrated,
  tabName,
  listContainerProps,
  onDragEnd,
  onItemLongPress,
  onItemContextMenu,
  onScrollBegin,
}: IMarketTokenListBaseProps) {
  const intl = useIntl();
  const toMarketDetailPage = useToDetailPage();
  const { navigateToPerps } = usePerpsNavigation();
  const { md } = useMedia();

  const marketTokenColumns = useMarketTokenColumns(
    networkId,
    isWatchlistMode,
    hideTokenAge,
    watchlistFrom,
    copyFrom,
  );

  const {
    data: rawData,
    isLoading,
    isLoadingMore,
    isNetworkSwitching,
    canLoadMore,
    loadMore,
    setSortBy,
    setSortType,
    initialSortBy,
    initialSortType,
    currentSortBy,
    currentSortType,
  } = result;

  // Client-side sorting: sort data locally when clientSort is enabled
  const data = useMemo(() => {
    if (!clientSort || !currentSortBy || !currentSortType) return rawData;
    const field = CLIENT_SORT_FIELD_MAP[currentSortBy];
    if (!field) return rawData;
    return [...rawData].toSorted((a, b) => {
      const aVal = (a[field] as number) ?? 0;
      const bVal = (b[field] as number) ?? 0;
      return currentSortType === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [clientSort, rawData, currentSortBy, currentSortType]);

  // Listen to MarketWatchlistOnlyChanged event to update sort settings
  // Skip for clientSort mode — banner detail pages manage their own sort state
  useEffect(() => {
    if (clientSort) return;

    const handleWatchlistOnlyChanged = (payload: {
      showWatchlistOnly: boolean;
    }) => {
      if (payload.showWatchlistOnly && isWatchlistMode) {
        setSortBy(undefined);
        setSortType(undefined);
      } else if (!payload.showWatchlistOnly && !isWatchlistMode) {
        setSortBy('v24hUSD');
        setSortType('desc');
      }
    };

    // Register event listener
    appEventBus.on(
      EAppEventBusNames.MarketWatchlistOnlyChanged,
      handleWatchlistOnlyChanged,
    );

    // Cleanup event listener on unmount
    return () => {
      appEventBus.off(
        EAppEventBusNames.MarketWatchlistOnlyChanged,
        handleWatchlistOnlyChanged,
      );
    };
  }, [setSortBy, setSortType, isWatchlistMode, clientSort]);

  const handleSortChange = useCallback(
    (sortBy: string, sortType: 'asc' | 'desc' | undefined) => {
      // Log sort action
      const sortWay =
        sortType === undefined
          ? ESortWay.Default
          : SORT_KEY_TO_ENUM[sortBy] || ESortWay.Default;

      defaultLogger.dex.list.dexSort({
        sortWay,
        sortDirection: sortType,
      });

      if (sortType === undefined) {
        setSortBy(initialSortBy);
        setSortType(initialSortType);
      } else {
        setSortBy(sortBy);
        setSortType(sortType);
      }
    },
    [setSortBy, setSortType, initialSortBy, initialSortType],
  );

  const handleHeaderRow = useCallback(
    (column: ITableColumn<IMarketToken>) => {
      if (!isWatchlistMode && !clientSort) {
        return undefined;
      }

      // Client sort mode uses all numeric columns,
      // watchlist mode uses restricted server-side sortable columns
      const columnsMap = clientSort
        ? CLIENT_SORTABLE_COLUMNS
        : SORTABLE_COLUMNS;
      const sortKey = columnsMap[column.dataIndex as keyof typeof columnsMap];

      if (sortKey) {
        const isCurrentSort = currentSortBy === sortKey;
        return {
          onSortTypeChange: (order: 'asc' | 'desc' | undefined) => {
            handleSortChange(sortKey, order);
          },
          initialSortOrder: isCurrentSort
            ? (currentSortType as ETableSortType)
            : undefined,
        };
      }

      return undefined;
    },
    [
      handleSortChange,
      isWatchlistMode,
      clientSort,
      currentSortBy,
      currentSortType,
    ],
  );

  // Stable ref for handleHeaderRow to avoid portalContent useMemo recreation
  // when sort state changes. Same ref pattern used in MobileLayout for perps category.
  const handleHeaderRowRef = useRef(handleHeaderRow);
  handleHeaderRowRef.current = handleHeaderRow;
  const stableHandleHeaderRow = useCallback(
    (...args: Parameters<typeof handleHeaderRow>) =>
      handleHeaderRowRef.current(...args),
    [],
  );

  const handleEndReached = useCallback(() => {
    if (canLoadMore && loadMore && !isLoadingMore) {
      void loadMore();
    }
  }, [canLoadMore, loadMore, isLoadingMore]);

  // Stable onRow handler — uses refs to avoid re-creating on every render,
  // which prevents the Table from seeing a new onRow prop and re-rendering all rows.
  const onItemPressRef = useRef(onItemPress);
  onItemPressRef.current = onItemPress;
  const onItemLongPressRef = useRef(onItemLongPress);
  onItemLongPressRef.current = onItemLongPress;
  const onItemContextMenuRef = useRef(onItemContextMenu);
  onItemContextMenuRef.current = onItemContextMenu;

  const stableOnRow = useCallback(
    (item: IMarketToken, index: number) => ({
      onPress: onItemPressRef.current
        ? () => onItemPressRef.current!(item)
        : () => {
            if (item.perpsCoin) {
              navigateToPerps(item.perpsCoin);
              return;
            }
            void toMarketDetailPage({
              symbol: item.symbol,
              tokenAddress: item.address,
              networkId: item.networkId,
              isNative: item.isNative,
            });
          },
      onLongPress: onItemLongPressRef.current
        ? () => onItemLongPressRef.current!(item, index)
        : undefined,
      onContextMenu: onItemContextMenuRef.current
        ? (position?: { x: number; y: number }) =>
            onItemContextMenuRef.current!(item, index, position)
        : undefined,
    }),
    [navigateToPerps, toMarketDetailPage],
  );

  // Show skeleton on initial load or network switching
  // Initial load: when there's no data yet
  // Network switching: when network is changing (provides better UX feedback)
  const showSkeleton =
    (Boolean(isLoading) && data.length === 0) || Boolean(isNetworkSwitching);

  const TableEmptyComponent = useMemo(() => {
    if (isLoading) return null;
    return (
      <Stack flex={1} alignItems="center" justifyContent="center" p="$8">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </Stack>
    );
  }, [isLoading, intl]);

  const TableFooterComponent = useMemo(() => {
    if (isLoadingMore) {
      return (
        <Stack alignItems="center" justifyContent="center" py="$4">
          <Spinner size="small" />
        </Stack>
      );
    }

    // End indicator is rendered outside the Table when draggable,
    // so it doesn't participate in absolute positioning during drag.
    if (
      !draggable &&
      showEndReachedIndicator &&
      !canLoadMore &&
      data.length > 0
    ) {
      return <ListEndIndicator />;
    }

    return null;
  }, [
    isLoadingMore,
    showEndReachedIndicator,
    canLoadMore,
    data.length,
    draggable,
  ]);
  const tabBarHeight = useScrollContentTabBarOffset();

  // On web with tabIntegrated, disable FlatList's own scroll so the outer
  // Tabs.Container handles scrolling (allows header to scroll away naturally).
  // Use IntersectionObserver as a replacement for onEndReached.
  const webTabIntegrated = tabIntegrated && !platformEnv.isNative;
  const endSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!webTabIntegrated) return;
    const sentinel = endSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          handleEndReached();
        }
      },
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [webTabIntegrated, handleEndReached]);

  // Desktop sticky header: portal the column header + toolbar into the
  // renderTabBar area so they stick when scrolling in the collapsible tab.
  const stickyHeaderCtx = useContext(DesktopStickyHeaderContext);
  const stickyPortalTarget = stickyHeaderCtx?.portalTarget ?? null;
  const isTabFocused = !tabName || stickyHeaderCtx?.activeTabName === tabName;
  const useDesktopPortal = webTabIntegrated && !!stickyPortalTarget && !md;

  const portalContent = useMemo(() => {
    if (!useDesktopPortal || !isTabFocused || !stickyPortalTarget) return null;
    return (
      <StickyHeaderPortal target={stickyPortalTarget}>
        <YStack bg="$bgApp" px="$4">
          {toolbar ? (
            <Stack width="100%" mb="$3">
              {toolbar}
            </Stack>
          ) : null}
          <Table.HeaderRow
            columns={marketTokenColumns}
            onHeaderRow={stableHandleHeaderRow}
          />
        </YStack>
      </StickyHeaderPortal>
    );
  }, [
    useDesktopPortal,
    isTabFocused,
    stickyPortalTarget,
    toolbar,
    marketTokenColumns,
    stableHandleHeaderRow,
  ]);

  return (
    <Stack flex={1} width="100%">
      {portalContent}
      {/* render custom toolbar if provided (only when not in desktop portal mode) */}
      {!useDesktopPortal ? toolbar : null}

      {/* Table container with horizontal scroll support */}
      <Stack
        flex={1}
        className="normal-scrollbar"
        style={{
          paddingTop: 4,
          overflowX: 'auto',
          // Explicitly set overflowY to prevent browsers from implicitly
          // changing it to 'auto' (CSS spec: setting one overflow axis to
          // non-visible forces the other to auto). Without this, drag
          // auto-scroll would bind to this horizontal wrapper instead of
          // the real vertical scroll container (Tabs.Container).
          overflowY: 'hidden',
          ...(md ? { marginLeft: 8, marginRight: 8 } : {}),
        }}
      >
        <Stack
          flex={1}
          minHeight={platformEnv.isNative ? undefined : 400}
          onTouchMove={
            platformEnv.isNative && onScrollBegin ? onScrollBegin : undefined
          }
        >
          {showSkeleton ? (
            <Table.Skeleton
              columns={marketTokenColumns}
              count={30}
              rowProps={{
                minHeight: '$14',
              }}
            />
          ) : (
            <Table<IMarketToken>
              contentContainerStyle={
                tabIntegrated
                  ? {
                      paddingTop: 8 + (platformEnv.isNative ? 195 : 0),
                      paddingBottom: platformEnv.isNativeAndroid
                        ? (listContainerProps?.paddingBottom ??
                          SPINNER_HEIGHT * 2)
                        : tabBarHeight,
                    }
                  : {
                      paddingBottom: platformEnv.isNativeAndroid
                        ? SPINNER_HEIGHT * 2
                        : tabBarHeight,
                    }
              }
              stickyHeader
              showHeader={showTableHeader ? !useDesktopPortal : false}
              scrollEnabled={!webTabIntegrated}
              draggable={draggable}
              tabIntegrated={tabIntegrated}
              onDragEnd={onDragEnd}
              columns={marketTokenColumns}
              onEndReached={handleEndReached}
              dataSource={data}
              keyExtractor={(item) => item.id}
              extraData={networkId}
              onHeaderRow={stableHandleHeaderRow}
              TableEmptyComponent={TableEmptyComponent}
              TableFooterComponent={TableFooterComponent}
              estimatedItemSize={60}
              onRow={stableOnRow}
            />
          )}
          {webTabIntegrated ? (
            <div ref={endSentinelRef} style={{ height: 1 }} />
          ) : null}
          {/* Render end indicator outside the Table for draggable lists
              so it doesn't participate in absolute positioning during drag. */}
          {draggable &&
          showEndReachedIndicator &&
          !canLoadMore &&
          data.length > 0 ? (
            <ListEndIndicator />
          ) : null}
        </Stack>
      </Stack>
    </Stack>
  );
}

export { MarketTokenListBase };
