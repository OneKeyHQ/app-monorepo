import { memo } from 'react';

import { useIntl } from 'react-intl';

import { Button, Empty, Spinner, Table, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useMarketStockColumns } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/useMarketStockColumns';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import {
  TOKEN_SELECTOR_HEADER_HEIGHT,
  TOKEN_SELECTOR_ROW_HEIGHT,
} from './constants';

type IMarketStockSelectorResult = {
  items: IMarketStockPublicItem[];
  failed?: boolean;
};

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
    });
    const normalizedQuery = query?.trim() ?? '';
    const {
      result = { items: [] },
      isLoading,
      run: retry,
    } = usePromiseResult<IMarketStockSelectorResult>(
      async () => {
        try {
          const response = normalizedQuery
            ? await backgroundApiProxy.serviceMarketV2.searchMarketStocks({
                query: normalizedQuery,
                limit: 50,
              })
            : await backgroundApiProxy.serviceMarketV2.fetchMarketStockList({
                limit: 50,
              });
          return { items: response.items };
        } catch {
          return { items: [], failed: true };
        }
      },
      [normalizedQuery],
      { initResult: { items: [] }, watchLoading: true },
    );
    if (isLoading && result.items.length === 0) {
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

    if (result.failed) {
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

    if (result.items.length === 0) {
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
          dataSource={result.items}
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
