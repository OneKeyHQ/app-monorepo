import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { UIEvent } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IMarketStockPublicItem,
  IMarketStockPublicListSortBy,
} from '@onekeyhq/shared/types/marketV2';

import {
  MARKET_DESKTOP_CONTENT_FRAME_PROPS,
  MARKET_LIST_ROW_HEIGHT,
} from '../../../marketDesktopLayoutConstants';
import { MarketTestIDs } from '../../../testIDs';
import { DesktopStickyHeaderContext } from '../../layouts/DesktopStickyHeaderContext';
import { MarketDesktopStickyHeader } from '../MarketDesktopStickyHeader';
import { MARKET_TOKEN_ROW_GROUP_NAME } from '../MarketHoverRevealLine';
import { MarketStockCategorySelector } from '../MarketTokenList/MarketStockCategorySelector';
import { StickyHeaderPortal } from '../StickyHeaderPortal';

import { useMarketStockList } from './hooks/useMarketStockList';
import { useToMarketStockDetailPage } from './hooks/useToMarketStockDetailPage';
import { useMarketStockColumns } from './useMarketStockColumns';

import type { IMarketCategoryItem } from '../../types';

const STOCK_LIST_MIN_WIDTH = 1240;
const STOCK_TABLE_MIN_WIDTH = 1216;

type IMarketStockListProps = {
  categories: IMarketCategoryItem[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  tabIntegrated?: boolean;
  tabName?: string;
  listContainerProps?: {
    paddingBottom: number;
  };
};

function MarketStockListImpl({
  categories,
  selectedCategoryId,
  onSelectCategory,
  tabIntegrated,
  tabName,
  listContainerProps,
}: IMarketStockListProps) {
  const intl = useIntl();
  const { md } = useMedia();
  const toMarketStockDetailPage = useToMarketStockDetailPage();
  const columns = useMarketStockColumns();
  const {
    items,
    isLoading,
    isLoadingMore,
    isLoadMoreError,
    isError,
    canLoadMore,
    sortBy,
    sortType,
    setSorting,
    loadMore,
    refresh,
  } = useMarketStockList({
    category: selectedCategoryId === 'all' ? undefined : selectedCategoryId,
  });
  const endSentinelRef = useRef<HTMLDivElement>(null);

  const CategorySelector = useMemo(
    () => (
      <MarketStockCategorySelector
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={onSelectCategory}
      />
    ),
    [categories, onSelectCategory, selectedCategoryId],
  );

  const handleHeaderRow = useCallback(
    (column: ITableColumn<IMarketStockPublicItem>) => {
      let serverSortBy:
        | Exclude<IMarketStockPublicListSortBy, 'default'>
        | undefined;
      if (column.dataIndex === 'price') {
        serverSortBy = 'price';
      } else if (column.dataIndex === 'priceChange24hPercent') {
        serverSortBy = 'priceChange24hPercent';
      }
      if (!serverSortBy) {
        return undefined;
      }
      return {
        onSortTypeChange: (order: 'asc' | 'desc' | undefined) => {
          setSorting(serverSortBy, order);
        },
        initialSortOrder:
          sortBy === serverSortBy ? (sortType as ETableSortType) : undefined,
      };
    },
    [setSorting, sortBy, sortType],
  );

  const handleEndReached = useCallback(() => {
    if (canLoadMore && !isLoadingMore && !isLoadMoreError) {
      void loadMore();
    }
  }, [canLoadMore, isLoadMoreError, isLoadingMore, loadMore]);

  const webTabIntegrated = Boolean(tabIntegrated && !platformEnv.isNative);
  useEffect(() => {
    if (!webTabIntegrated || !canLoadMore) {
      return;
    }
    const sentinel = endSentinelRef.current;
    if (!sentinel) {
      return;
    }
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
  }, [canLoadMore, handleEndReached, webTabIntegrated]);

  const stickyHeaderCtx = useContext(DesktopStickyHeaderContext);
  const stickyPortalTarget = stickyHeaderCtx?.portalTarget ?? null;
  const isTabFocused = !tabName || stickyHeaderCtx?.activeTabName === tabName;
  const useDesktopPortal =
    webTabIntegrated && Boolean(stickyPortalTarget) && !md;

  // The rows can scroll sideways below `STOCK_LIST_MIN_WIDTH`, but the header
  // is portalled into the tab bar and cannot see that scroller. Feed it the
  // offset so the column titles stay over their cells.
  const [rowsScrollLeft, setRowsScrollLeft] = useState(0);
  const handleRowsScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const next = event.currentTarget.scrollLeft;
    setRowsScrollLeft((prev) => (prev === next ? prev : next));
  }, []);

  const portalContent = useMemo(() => {
    if (!useDesktopPortal || !isTabFocused || !stickyPortalTarget) {
      return null;
    }
    return (
      <StickyHeaderPortal target={stickyPortalTarget}>
        <MarketDesktopStickyHeader<IMarketStockPublicItem>
          toolbar={CategorySelector}
          columns={columns}
          onHeaderRow={handleHeaderRow}
          rowProps={{ width: '100%', minWidth: STOCK_TABLE_MIN_WIDTH }}
          scrollLeft={rowsScrollLeft}
        />
      </StickyHeaderPortal>
    );
  }, [
    CategorySelector,
    columns,
    handleHeaderRow,
    isTabFocused,
    rowsScrollLeft,
    stickyPortalTarget,
    useDesktopPortal,
  ]);

  const tabBarHeight = useScrollContentTabBarOffset();
  const contentPaddingBottom =
    listContainerProps?.paddingBottom ?? tabBarHeight;
  const showSkeleton = isLoading && items.length === 0;

  const TableEmptyComponent = useMemo(() => {
    if (isLoading) {
      return null;
    }
    return (
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        p="$8"
        gap="$3"
      >
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
        {isError ? (
          <Button
            testID="market-stock-list-retry"
            size="small"
            variant="tertiary"
            onPress={() => void refresh()}
          >
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        ) : null}
      </YStack>
    );
  }, [intl, isError, isLoading, refresh]);

  const TableFooterComponent = useMemo(() => {
    if (isLoadingMore) {
      return (
        <Stack alignItems="center" justifyContent="center" py="$4">
          <Spinner size="small" />
        </Stack>
      );
    }
    if (isLoadMoreError) {
      return (
        <Stack alignItems="center" justifyContent="center" py="$4">
          <Button
            testID="market-stock-list-load-more-retry"
            size="small"
            variant="tertiary"
            onPress={() => void loadMore()}
          >
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        </Stack>
      );
    }
    if (canLoadMore && webTabIntegrated) {
      return <div ref={endSentinelRef} style={{ height: 1 }} />;
    }
    if (items.length > 0 && !canLoadMore) {
      return <ListEndIndicator />;
    }
    return null;
  }, [
    canLoadMore,
    intl,
    isLoadMoreError,
    isLoadingMore,
    items.length,
    loadMore,
    webTabIntegrated,
  ]);

  return (
    <Stack flex={1} width="100%" testID={MarketTestIDs.stockList}>
      {portalContent}
      {useDesktopPortal ? null : (
        <YStack {...MARKET_DESKTOP_CONTENT_FRAME_PROPS}>
          {CategorySelector}
        </YStack>
      )}
      <Stack
        {...MARKET_DESKTOP_CONTENT_FRAME_PROPS}
        flex={1}
        className="normal-scrollbar"
        style={{ overflowX: 'auto', overflowY: 'hidden' }}
        onScroll={handleRowsScroll}
      >
        <Stack flex={1} minWidth={STOCK_LIST_MIN_WIDTH} minHeight={400} px="$3">
          {showSkeleton ? (
            <Table.Skeleton
              columns={columns}
              count={8}
              rowProps={{
                width: '100%',
                minWidth: STOCK_TABLE_MIN_WIDTH,
                height: MARKET_LIST_ROW_HEIGHT,
              }}
            />
          ) : (
            <Table<IMarketStockPublicItem>
              contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
              stickyHeader
              showHeader={!useDesktopPortal}
              scrollEnabled={!webTabIntegrated}
              tabIntegrated={tabIntegrated}
              columns={columns}
              dataSource={items}
              keyExtractor={(item) => item.stockId}
              estimatedItemSize={72}
              onEndReached={webTabIntegrated ? undefined : handleEndReached}
              onHeaderRow={handleHeaderRow}
              rowProps={{
                width: '100%',
                minWidth: STOCK_TABLE_MIN_WIDTH,
                height: MARKET_LIST_ROW_HEIGHT,
              }}
              headerRowProps={{ height: 36 }}
              TableEmptyComponent={TableEmptyComponent}
              TableFooterComponent={TableFooterComponent}
              onRow={(item) => ({
                onPress: () => void toMarketStockDetailPage(item),
                rowProps: {
                  testID: MarketTestIDs.stockRow(item.stockId),
                  // Data rows only: the company cell swaps its subtitle for the
                  // variant summary while the row is hovered. The header row
                  // shares `rowProps` above and must not become a group.
                  group: MARKET_TOKEN_ROW_GROUP_NAME,
                },
              })}
            />
          )}
        </Stack>
      </Stack>
    </Stack>
  );
}

export const MarketStockList = memo(MarketStockListImpl);
