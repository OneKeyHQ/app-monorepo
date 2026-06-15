import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
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

import {
  applyMarketTokenListLiveOverrides,
  useMarketHomeTokenListWebSocket,
} from './hooks/useMarketHomeTokenListWebSocket';
import { useMarketTokenColumns } from './hooks/useMarketTokenColumns';
import { useToDetailPage } from './hooks/useToMarketDetailPage';
import { type IMarketToken } from './MarketTokenData';
import {
  shouldShowStockSubtitleForTokens,
  shouldUseStockMetadataColumnsForTokens,
} from './utils/tokenListHelpers';

import type { IMarketTokenListLiveOverride } from './hooks/useMarketHomeTokenListWebSocket';

const SPINNER_HEIGHT = 52;
const MARKET_HOME_WS_ROW_HEIGHT_PX = 60;
const MARKET_HOME_WS_OVERSCAN_ROWS = 5;
const MARKET_HOME_WS_MAX_SUBSCRIPTIONS = 80;
const MARKET_HOME_WS_SCROLL_SYNC_DELAY_MS = 120;
const MARKET_HOME_WS_DEBUG_SUBSCRIPTION_ROW_BG = 'rgba(255, 72, 72, 0.12)';
// Watchlist mode: only these 3 columns are sortable (server-side sort)
const SORTABLE_COLUMNS = {
  liquidity: 'liquidity',
  marketCap: 'mc',
  turnover: 'v24hUSD',
} as const;

// Client sort mode is used by banner detail and only supports 24h change.
const CLIENT_SORTABLE_COLUMNS: Record<string, string> = {
  change24h: 'change24h',
};

// Sort key → IMarketToken field mapping for client-side sorting
const CLIENT_SORT_FIELD_MAP: Record<string, keyof IMarketToken> = {
  change24h: 'change24h',
};

// Map sort keys to ESortWay enum values for logging
const SORT_KEY_TO_ENUM: Record<string, ESortWay> = {
  liquidity: ESortWay.Liquidity,
  mc: ESortWay.MC,
  v24hUSD: ESortWay.Volume,
};

const STOCK_METADATA_COLUMN_DATA_INDEXES = new Set([
  'marketCap',
  'liquidity',
  'turnover',
]);

type IMarketHomeSubscriptionRange = {
  start: number;
  end: number;
};

function isSameSubscriptionRange(
  a: IMarketHomeSubscriptionRange,
  b: IMarketHomeSubscriptionRange,
) {
  return a.start === b.start && a.end === b.end;
}

function getMarketHomeScrollContainer(element: HTMLElement | null) {
  return element?.closest?.('.onekey-tabs-container') as HTMLElement | null;
}

function getLimitedSubscriptionRange({
  tokenCount,
  visibleStartIndex,
  visibleEndIndex,
}: {
  tokenCount: number;
  visibleStartIndex: number;
  visibleEndIndex: number;
}): IMarketHomeSubscriptionRange {
  if (tokenCount <= 0) {
    return { start: 0, end: 0 };
  }

  const normalizedVisibleStart = Math.min(
    Math.max(0, visibleStartIndex),
    tokenCount - 1,
  );
  const normalizedVisibleEnd = Math.min(
    Math.max(normalizedVisibleStart + 1, visibleEndIndex),
    tokenCount,
  );
  const visibleCount = normalizedVisibleEnd - normalizedVisibleStart;
  const maxCount = Math.min(MARKET_HOME_WS_MAX_SUBSCRIPTIONS, tokenCount);

  let start = Math.max(
    0,
    normalizedVisibleStart - MARKET_HOME_WS_OVERSCAN_ROWS,
  );
  let end = Math.min(
    tokenCount,
    normalizedVisibleEnd + MARKET_HOME_WS_OVERSCAN_ROWS,
  );

  if (end - start > maxCount) {
    const beforeCount = Math.max(0, Math.floor((maxCount - visibleCount) / 2));
    start = Math.max(0, normalizedVisibleStart - beforeCount);
    end = Math.min(tokenCount, start + maxCount);
    start = Math.max(0, end - maxCount);
  }

  return { start, end };
}

function getMarketHomeVisibleSubscriptionRange({
  rootElement,
  tokenCount,
}: {
  rootElement: HTMLElement | null;
  tokenCount: number;
}): IMarketHomeSubscriptionRange {
  if (tokenCount <= 0) {
    return { start: 0, end: 0 };
  }

  const fallbackRange = getLimitedSubscriptionRange({
    tokenCount,
    visibleStartIndex: 0,
    visibleEndIndex: MARKET_HOME_WS_MAX_SUBSCRIPTIONS,
  });

  if (platformEnv.isNative || !rootElement) {
    return fallbackRange;
  }

  const scrollContainer = getMarketHomeScrollContainer(rootElement);
  if (!scrollContainer) {
    return fallbackRange;
  }

  const viewportHeight =
    scrollContainer.clientHeight || globalThis.window?.innerHeight || 0;
  if (!viewportHeight) {
    return fallbackRange;
  }

  const containerRect = scrollContainer.getBoundingClientRect();
  const rootRect = rootElement.getBoundingClientRect();
  const scrollTop = scrollContainer.scrollTop;
  const rootTopInScrollContent = rootRect.top - containerRect.top + scrollTop;
  const visibleTop = scrollTop - rootTopInScrollContent;
  const visibleBottom = visibleTop + viewportHeight;

  return getLimitedSubscriptionRange({
    tokenCount,
    visibleStartIndex: Math.floor(visibleTop / MARKET_HOME_WS_ROW_HEIGHT_PX),
    visibleEndIndex: Math.ceil(visibleBottom / MARKET_HOME_WS_ROW_HEIGHT_PX),
  });
}

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
  showStockSubtitle?: boolean | 'auto';
  hiddenDesktopColumns?: readonly string[];
  change24hColumnTitle?: string;
  liveTokenOverride?: IMarketTokenListLiveOverride;
  enableWebSocket?: boolean;
  rowBg?: string;
  testID?: string;
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
  showStockSubtitle = true,
  hiddenDesktopColumns,
  change24hColumnTitle,
  liveTokenOverride,
  enableWebSocket,
  rowBg,
  testID,
}: IMarketTokenListBaseProps) {
  const intl = useIntl();
  const toMarketDetailPage = useToDetailPage();
  const { navigateToPerps } = usePerpsNavigation();
  const { md } = useMedia();
  const stickyHeaderCtx = useContext(DesktopStickyHeaderContext);
  const isTabFocused = !tabName || stickyHeaderCtx?.activeTabName === tabName;
  const listRootRef = useRef<HTMLElement | null>(null);
  const [devSettings] = useDevSettingsPersistAtom();

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
  const webSocketEnabled = Boolean(
    enableWebSocket && isTabFocused && !platformEnv.isNative && !md,
  );
  const orderedData = useMemo(() => {
    if (!clientSort || !currentSortBy || !currentSortType) {
      return rawData;
    }

    const field = CLIENT_SORT_FIELD_MAP[currentSortBy];
    if (!field) {
      return rawData;
    }

    return [...rawData].toSorted((a, b) => {
      const aVal = (a[field] as number) ?? 0;
      const bVal = (b[field] as number) ?? 0;
      return currentSortType === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [clientSort, currentSortBy, currentSortType, rawData]);
  const [subscriptionRange, setSubscriptionRange] =
    useState<IMarketHomeSubscriptionRange>({ start: 0, end: 0 });
  const updateSubscriptionRange = useCallback(() => {
    const nextRange = webSocketEnabled
      ? getMarketHomeVisibleSubscriptionRange({
          rootElement: listRootRef.current,
          tokenCount: orderedData.length,
        })
      : { start: 0, end: 0 };

    setSubscriptionRange((prev) =>
      isSameSubscriptionRange(prev, nextRange) ? prev : nextRange,
    );
  }, [orderedData.length, webSocketEnabled]);

  useEffect(() => {
    updateSubscriptionRange();

    if (!webSocketEnabled || orderedData.length === 0 || platformEnv.isNative) {
      return;
    }

    const scrollContainer = getMarketHomeScrollContainer(listRootRef.current);
    if (!scrollContainer) {
      return;
    }

    let syncTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleSubscriptionRangeUpdate = () => {
      if (syncTimer) {
        clearTimeout(syncTimer);
      }
      syncTimer = setTimeout(
        updateSubscriptionRange,
        MARKET_HOME_WS_SCROLL_SYNC_DELAY_MS,
      );
    };

    scrollContainer.addEventListener(
      'scroll',
      scheduleSubscriptionRangeUpdate,
      {
        passive: true,
      },
    );
    const globalWindow = globalThis.window;
    if (globalWindow) {
      globalWindow.addEventListener('resize', scheduleSubscriptionRangeUpdate);
    }

    return () => {
      if (syncTimer) {
        clearTimeout(syncTimer);
      }
      scrollContainer.removeEventListener(
        'scroll',
        scheduleSubscriptionRangeUpdate,
      );
      if (globalWindow) {
        globalWindow.removeEventListener(
          'resize',
          scheduleSubscriptionRangeUpdate,
        );
      }
    };
  }, [orderedData.length, updateSubscriptionRange, webSocketEnabled]);

  const subscriptionTokens = useMemo(
    () => orderedData.slice(subscriptionRange.start, subscriptionRange.end),
    [orderedData, subscriptionRange.end, subscriptionRange.start],
  );
  const showMarketHomeWsDebug = Boolean(
    devSettings.enabled &&
    devSettings.settings?.showMarketHomeWsDebug &&
    !platformEnv.isNative,
  );
  const showWebSocketDebugRows = showMarketHomeWsDebug && webSocketEnabled;
  const [webSocketSubscriptionCount, setWebSocketSubscriptionCount] =
    useState(0);
  const websocketData = useMarketHomeTokenListWebSocket({
    tokens: orderedData,
    subscriptionTokens,
    enabled: webSocketEnabled,
    onSubscriptionCountChange: showMarketHomeWsDebug
      ? setWebSocketSubscriptionCount
      : undefined,
  });

  useEffect(() => {
    if (!showMarketHomeWsDebug || !webSocketEnabled) {
      setWebSocketSubscriptionCount(0);
    }
  }, [showMarketHomeWsDebug, webSocketEnabled]);

  const hasStock = useMemo(
    () => rawData.some((item) => !!item.stock),
    [rawData],
  );
  const resolvedShowStockSubtitle = useMemo(() => {
    if (showStockSubtitle !== 'auto') {
      return showStockSubtitle;
    }

    return shouldShowStockSubtitleForTokens(rawData);
  }, [rawData, showStockSubtitle]);
  const useStockMetadataColumns = useMemo(
    () =>
      (showStockSubtitle === 'auto' ||
        (isWatchlistMode && showStockSubtitle !== false)) &&
      shouldUseStockMetadataColumnsForTokens(rawData),
    [isWatchlistMode, rawData, showStockSubtitle],
  );

  const marketTokenColumns = useMarketTokenColumns(
    networkId,
    isWatchlistMode,
    hideTokenAge,
    watchlistFrom,
    copyFrom,
    hasStock,
    resolvedShowStockSubtitle,
    hiddenDesktopColumns,
    change24hColumnTitle,
    useStockMetadataColumns,
  );

  const data = useMemo(() => {
    if (!liveTokenOverride) {
      return websocketData;
    }

    return applyMarketTokenListLiveOverrides({
      tokens: websocketData,
      liveTokenOverrides: [liveTokenOverride],
    });
  }, [websocketData, liveTokenOverride]);

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

      if (
        useStockMetadataColumns &&
        STOCK_METADATA_COLUMN_DATA_INDEXES.has(String(column.dataIndex))
      ) {
        return undefined;
      }

      // Client sort mode is used by banner detail for 24h change sorting,
      // watchlist mode uses restricted server-side sortable columns.
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
      useStockMetadataColumns,
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
  const debugSubscriptionRangeStart = showWebSocketDebugRows
    ? subscriptionRange.start
    : 0;
  const debugSubscriptionRangeEnd = showWebSocketDebugRows
    ? subscriptionRange.end
    : 0;

  const stableOnRow = useCallback(
    (item: IMarketToken, index: number) => {
      return {
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
        rowProps:
          showWebSocketDebugRows &&
          !item.perpsCoin &&
          !!item.networkId &&
          !!item.address &&
          index >= debugSubscriptionRangeStart &&
          index < debugSubscriptionRangeEnd
            ? { bg: MARKET_HOME_WS_DEBUG_SUBSCRIPTION_ROW_BG }
            : undefined,
      };
    },
    [
      debugSubscriptionRangeEnd,
      debugSubscriptionRangeStart,
      navigateToPerps,
      showWebSocketDebugRows,
      toMarketDetailPage,
    ],
  );

  // Show skeleton only when there's no data to display.
  // When switching networks with existing data, keep old data visible
  // until new data arrives — avoids unnecessary skeleton flash.
  const showSkeleton =
    (Boolean(isLoading) || Boolean(isNetworkSwitching)) && data.length === 0;

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

  const tabBarHeight = useScrollContentTabBarOffset();

  // On web with tabIntegrated, disable FlatList's own scroll so the outer
  // Tabs.Container handles scrolling (allows header to scroll away naturally).
  // Use IntersectionObserver as a replacement for onEndReached.
  const webTabIntegrated = tabIntegrated && !platformEnv.isNative;
  const endSentinelRef = useRef<HTMLDivElement>(null);

  const TableFooterComponent = useMemo(() => {
    if (isLoadingMore) {
      return (
        <Stack alignItems="center" justifyContent="center" py="$4">
          <Spinner size="small" />
        </Stack>
      );
    }

    // On native draggable lists the end indicator stays outside the Table so it
    // doesn't participate in absolute positioning during drag. On web tab
    // integration it must be inside the Table so height registration includes it.
    if (
      (!draggable || webTabIntegrated) &&
      showEndReachedIndicator &&
      !canLoadMore &&
      data.length > 0
    ) {
      return <ListEndIndicator />;
    }

    if (webTabIntegrated && canLoadMore) {
      return <div ref={endSentinelRef} style={{ height: 1 }} />;
    }

    return null;
  }, [
    isLoadingMore,
    webTabIntegrated,
    showEndReachedIndicator,
    canLoadMore,
    data.length,
    draggable,
  ]);

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
  const stickyPortalTarget = stickyHeaderCtx?.portalTarget ?? null;
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

  let integratedContentPaddingBottom = tabBarHeight;
  if (platformEnv.isNativeAndroid) {
    integratedContentPaddingBottom =
      listContainerProps?.paddingBottom ?? SPINNER_HEIGHT * 2;
  } else if (webTabIntegrated) {
    integratedContentPaddingBottom =
      listContainerProps?.paddingBottom ?? tabBarHeight;
  }

  const tableContentContainerStyle = tabIntegrated
    ? {
        paddingTop: 4 + (platformEnv.isNative ? 195 : 0),
        paddingBottom: integratedContentPaddingBottom,
      }
    : {
        paddingBottom: platformEnv.isNativeAndroid
          ? SPINNER_HEIGHT * 2
          : tabBarHeight,
      };
  const showWebSocketDebugOverlay = showMarketHomeWsDebug && webSocketEnabled;
  const webSocketDebugOverlayStyle = useMemo(
    () => ({
      position: 'fixed' as const,
      right: 20,
      bottom: 20,
    }),
    [],
  );

  return (
    <Stack ref={listRootRef as any} flex={1} width="100%" testID={testID}>
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
              contentContainerStyle={tableContentContainerStyle}
              stickyHeader
              showHeader={showTableHeader ? !useDesktopPortal : false}
              scrollEnabled={!webTabIntegrated}
              draggable={draggable}
              tabIntegrated={tabIntegrated}
              onDragEnd={onDragEnd}
              columns={marketTokenColumns}
              onEndReached={webTabIntegrated ? undefined : handleEndReached}
              dataSource={data}
              keyExtractor={(item) => item.id}
              extraData={networkId}
              onHeaderRow={stableHandleHeaderRow}
              TableEmptyComponent={TableEmptyComponent}
              TableFooterComponent={TableFooterComponent}
              estimatedItemSize={60}
              onRow={stableOnRow}
              {...(rowBg ? { rowProps: { bg: rowBg } } : undefined)}
            />
          )}
          {/* Render end indicator outside the Table for draggable lists
              so it doesn't participate in absolute positioning during drag. */}
          {draggable &&
          !webTabIntegrated &&
          showEndReachedIndicator &&
          !canLoadMore &&
          data.length > 0 ? (
            <ListEndIndicator />
          ) : null}
        </Stack>
      </Stack>
      {showWebSocketDebugOverlay ? (
        <Stack
          style={webSocketDebugOverlayStyle}
          zIndex={9999}
          pointerEvents="none"
          bg="rgba(255, 72, 72, 0.88)"
          px="$3"
          py="$2"
          borderRadius="$2"
          borderWidth={1}
          borderColor="rgba(255, 255, 255, 0.32)"
        >
          <SizableText size="$bodySmMedium" color="$textOnColor">
            {`当前订阅: ${webSocketSubscriptionCount}`}
          </SizableText>
        </Stack>
      ) : null}
    </Stack>
  );
}

export { MarketTokenListBase };
export type { IMarketTokenListLiveOverride };
