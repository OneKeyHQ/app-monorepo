import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Empty,
  ListEndIndicator,
  Spinner,
  Stack,
  Table,
  YStack,
} from '@onekeyhq/components';
import { useMarketStockColumns } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/useMarketStockColumns';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import {
  TOKEN_SELECTOR_HEADER_HEIGHT,
  TOKEN_SELECTOR_ROW_HEIGHT,
} from './constants';
import { useMarketStockSelectorList } from './useMarketStockSelectorList';

const STOCK_SELECTOR_LIST_HEIGHT = 350;
const STOCK_SELECTOR_TABLE_HEIGHT =
  STOCK_SELECTOR_LIST_HEIGHT + TOKEN_SELECTOR_HEADER_HEIGHT;

const MarketStockSelectorList = memo(
  ({
    query,
    onItemPress,
  }: {
    query?: string;
    onItemPress: (item: IMarketStockPublicItem) => void;
  }) => {
    const intl = useIntl();
    // The selector dropdown is a picker, not the full Market Stocks table, so
    // it drops the 24h price range sparkline column.
    const columns = useMarketStockColumns({
      compact: true,
      showSparkline: false,
      showWatchlist: true,
      watchlistFrom: EWatchlistFrom.Search,
    });
    const normalizedQuery = query?.trim() ?? '';
    const {
      items,
      isLoading,
      isError,
      isLoadingMore,
      isLoadMoreError,
      canLoadMore,
      loadMore,
      refresh: retry,
    } = useMarketStockSelectorList({ query: normalizedQuery });
    const handleEndReached = useCallback(() => {
      if (canLoadMore && !isLoadingMore && !isLoadMoreError) {
        void loadMore();
      }
    }, [canLoadMore, isLoadMoreError, isLoadingMore, loadMore]);
    const tableFooterComponent = useMemo(() => {
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
              testID="market-stock-selector-load-more-retry"
              size="small"
              variant="tertiary"
              onPress={() => void loadMore()}
            >
              {intl.formatMessage({ id: ETranslations.global_retry })}
            </Button>
          </Stack>
        );
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
    ]);

    if (isLoading && items.length === 0) {
      return (
        <YStack
          testID="market-stock-selector-loading"
          height={STOCK_SELECTOR_TABLE_HEIGHT}
          alignItems="center"
          justifyContent="center"
        >
          <Spinner size="large" />
        </YStack>
      );
    }

    if (isError) {
      return (
        <YStack
          height={STOCK_SELECTOR_TABLE_HEIGHT}
          alignItems="center"
          justifyContent="center"
        >
          <Empty
            illustration="QuestionMark"
            title={intl.formatMessage({
              id: ETranslations.global_connet_error_try_again,
            })}
          />
          <Button
            testID="market-stock-selector-retry"
            size="small"
            variant="secondary"
            onPress={() => void retry()}
          >
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        </YStack>
      );
    }

    if (items.length === 0 && !canLoadMore) {
      return (
        <YStack
          height={STOCK_SELECTOR_TABLE_HEIGHT}
          alignItems="center"
          justifyContent="center"
        >
          <Empty
            illustration="QuestionMark"
            title={intl.formatMessage({ id: ETranslations.global_no_results })}
          />
        </YStack>
      );
    }

    return (
      <YStack height={STOCK_SELECTOR_TABLE_HEIGHT}>
        <Table<IMarketStockPublicItem>
          columns={columns}
          dataSource={items}
          keyExtractor={(item) => item.stockId}
          estimatedItemSize={TOKEN_SELECTOR_ROW_HEIGHT}
          estimatedListSize={{ width: 800, height: STOCK_SELECTOR_LIST_HEIGHT }}
          rowProps={{
            width: '100%',
            height: TOKEN_SELECTOR_ROW_HEIGHT,
            minHeight: TOKEN_SELECTOR_ROW_HEIGHT,
            // The Table bakes an $3 radius into every row; the selector rows
            // hover edge-to-edge like the other tabs, so it is squared off.
            borderRadius: '$0',
          }}
          // Table spreads rowProps into the header row before headerRowProps,
          // so the row minHeight must be overridden here or the header stays
          // 56px tall no matter what height it is given.
          headerRowProps={{
            height: TOKEN_SELECTOR_HEADER_HEIGHT,
            minHeight: TOKEN_SELECTOR_HEADER_HEIGHT,
          }}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.2}
          TableFooterComponent={tableFooterComponent}
          onRow={(item) => ({
            onPress: () => onItemPress(item),
            rowProps: {
              testID: `market-stock-selector-row-${item.stockId}`,
            },
          })}
        />
      </YStack>
    );
  },
);

MarketStockSelectorList.displayName = 'MarketStockSelectorList';

export { MarketStockSelectorList };
