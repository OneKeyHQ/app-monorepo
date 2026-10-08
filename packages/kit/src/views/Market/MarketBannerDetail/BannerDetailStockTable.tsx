import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  SizableText,
  Stack,
  Table,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useTabBarHeight } from '@onekeyhq/components/src/layouts/Page/hooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import {
  MARKET_LIST_HEADER_ROW_HEIGHT,
  MARKET_LIST_ROW_HEIGHT,
} from '../marketDesktopLayoutConstants';
import { MARKET_TOKEN_ROW_GROUP_NAME } from '../MarketHomeV2/components/MarketHoverRevealLine';
import { useMarketStockColumns } from '../MarketHomeV2/components/MarketStockList/useMarketStockColumns';
import { STOCK_METRIC_COLUMN_MINIMUM_WIDTHS } from '../MarketHomeV2/components/MarketStockList/utils';
import { useMarketDesktopResponsiveColumns } from '../MarketHomeV2/components/useMarketDesktopResponsiveColumns';
import { MarketTestIDs } from '../testIDs';

import { useBannerDetailTableSort } from './useBannerDetailTableSort';

// The Stocks tab sorts these columns on the server (see
// `getMarketStockSortByColumn`); the banner endpoint has no sort params, so
// the same columns sort in memory on their own record field.
const STOCK_SORTABLE_FIELDS: Record<string, keyof IMarketStockPublicItem> = {
  price: 'price',
  priceChange24hPercent: 'priceChange24hPercent',
  marketCap: 'marketCap',
  volume24h: 'volume24h',
};

export function BannerDetailStockTable({
  items,
  isLoading,
  onItemPress,
}: {
  items: IMarketStockPublicItem[];
  isLoading: boolean;
  onItemPress: (item: IMarketStockPublicItem) => void;
}) {
  const intl = useIntl();
  const { md } = useMedia();
  const tabBarHeight = useTabBarHeight();
  const baseColumns = useMarketStockColumns({
    showWatchlist: true,
    watchlistFrom: EWatchlistFrom.BannerList,
  });
  const { columns, handleContainerLayout } = useMarketDesktopResponsiveColumns({
    columns: baseColumns,
    enabled: !platformEnv.isNative && !md,
    firstColumnCount: 1,
    horizontalInset: 24,
    metricColumnMinimumWidths: STOCK_METRIC_COLUMN_MINIMUM_WIDTHS,
  });
  const { sortedData, handleHeaderRow } = useBannerDetailTableSort({
    data: items,
    columns,
    sortableFields: STOCK_SORTABLE_FIELDS,
  });

  const showSkeleton = isLoading && items.length === 0;

  const TableEmptyComponent = useMemo(() => {
    if (isLoading) {
      return null;
    }
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" p="$8">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </YStack>
    );
  }, [intl, isLoading]);

  const handleRow = useCallback(
    (item: IMarketStockPublicItem) => ({
      onPress: () => onItemPress(item),
      rowProps: {
        testID: MarketTestIDs.stockRow(item.stockId),
        // Data rows only: the company cell swaps its subtitle for the variant
        // summary while hovered. The header row must not become a group.
        group: MARKET_TOKEN_ROW_GROUP_NAME,
      },
    }),
    [onItemPress],
  );

  const table = showSkeleton ? (
    <Table.Skeleton
      columns={columns}
      count={8}
      rowProps={{ width: '100%', height: MARKET_LIST_ROW_HEIGHT }}
    />
  ) : (
    <Table<IMarketStockPublicItem>
      contentContainerStyle={{ paddingBottom: tabBarHeight }}
      stickyHeader
      columns={columns}
      dataSource={sortedData}
      keyExtractor={(item) => item.stockId}
      estimatedItemSize={MARKET_LIST_ROW_HEIGHT}
      onHeaderRow={handleHeaderRow}
      rowProps={{ width: '100%', height: MARKET_LIST_ROW_HEIGHT }}
      headerRowProps={{ height: MARKET_LIST_HEADER_ROW_HEIGHT }}
      TableEmptyComponent={TableEmptyComponent}
      onRow={handleRow}
    />
  );

  // The banner detail page only mounts this table on non-native wide layouts,
  // so the web scroller is unconditional.
  return (
    <Stack
      flex={1}
      width="100%"
      className="normal-scrollbar"
      style={{ overflowX: 'auto', overflowY: 'hidden' }}
      onLayout={handleContainerLayout}
      testID={MarketTestIDs.stockList}
    >
      <Stack flex={1} minHeight={400} px="$3">
        {table}
      </Stack>
    </Stack>
  );
}
