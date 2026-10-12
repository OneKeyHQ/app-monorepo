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
  TOKEN_SELECTOR_POPOVER_WIDTH,
  TOKEN_SELECTOR_ROW_HEIGHT,
  TOKEN_SELECTOR_TABLE_PADDING,
} from './constants';
import { useMarketStockSelectorList } from './useMarketStockSelectorList';

const STOCK_SELECTOR_LIST_HEIGHT = 350;

const MarketStockSelectorList = memo(
  ({
    query,
    category,
    onItemPress,
    extraHeight = 0,
  }: {
    query?: string;
    category?: string;
    onItemPress: (item: IMarketStockPublicItem) => void;
    /** Height handed over when no chip band shows above the list. */
    extraHeight?: number;
  }) => {
    const intl = useIntl();
    const listHeight = STOCK_SELECTOR_LIST_HEIGHT + extraHeight;
    const tableHeight = listHeight + TOKEN_SELECTOR_HEADER_HEIGHT;
    // The selector dropdown is a picker, not the full Market Stocks table, so
    // it drops the 24h price range sparkline column.
    const columns = useMarketStockColumns({
      compact: true,
      showSparkline: false,
      showWatchlist: true,
      showMarketTags: true,
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
      isRevalidatingFirstPage,
      loadMore,
      refresh: retry,
    } = useMarketStockSelectorList({
      query: normalizedQuery,
      ...(category ? { category } : {}),
    });
    const handleEndReached = useCallback(() => {
      if (isLoadMoreError || isLoadingMore) {
        return;
      }
      if (isRevalidatingFirstPage || canLoadMore) {
        void loadMore();
      }
    }, [
      canLoadMore,
      isLoadMoreError,
      isLoadingMore,
      isRevalidatingFirstPage,
      loadMore,
    ]);
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
      if (items.length > 0 && !canLoadMore && !isRevalidatingFirstPage) {
        return <ListEndIndicator />;
      }
      return null;
    }, [
      canLoadMore,
      intl,
      isLoadMoreError,
      isLoadingMore,
      isRevalidatingFirstPage,
      items.length,
      loadMore,
    ]);

    if (isLoading && items.length === 0) {
      return (
        <YStack
          testID="market-stock-selector-loading"
          height={tableHeight}
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
          height={tableHeight}
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
          height={tableHeight}
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
      <YStack height={tableHeight} px={TOKEN_SELECTOR_TABLE_PADDING}>
        <Table<IMarketStockPublicItem>
          columns={columns}
          dataSource={items}
          keyExtractor={(item) => item.stockId}
          estimatedItemSize={TOKEN_SELECTOR_ROW_HEIGHT}
          estimatedListSize={{
            width: TOKEN_SELECTOR_POPOVER_WIDTH,
            height: listHeight,
          }}
          rowProps={{
            bg: '$bg',
            width: '100%',
            height: TOKEN_SELECTOR_ROW_HEIGHT,
            minHeight: TOKEN_SELECTOR_ROW_HEIGHT,
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
