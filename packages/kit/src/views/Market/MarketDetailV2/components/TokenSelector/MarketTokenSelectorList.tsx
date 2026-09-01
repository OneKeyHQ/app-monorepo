import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  ListView,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';
import type { IMarketTokenDetailPreview } from '@onekeyhq/shared/types/marketV2';

import { useMarketTokenList } from '../../../MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenList';
import { useMarketWatchlistTokenList } from '../../../MarketHomeV2/components/MarketTokenList/hooks/useMarketWatchlistTokenList';
import { buildMarketSearchTokenDetailPreview } from '../../utils/marketDetailPreview';

import {
  TOKEN_SELECTOR_COLUMN_PADDING,
  TOKEN_SELECTOR_HEADER_HEIGHT,
  TOKEN_SELECTOR_METRIC_COLUMNS,
  TOKEN_SELECTOR_NAME_GAP,
  TOKEN_SELECTOR_POLLING_INTERVAL,
  TOKEN_SELECTOR_ROW_HEIGHT,
  TOKEN_SELECTOR_STAR_COLUMN_WIDTH,
  convertSearchTokenToMarketToken,
  getTokenSelectorColumnWidths,
} from './constants';
import { MarketTokenSelectorRow } from './MarketTokenSelectorRow';

import type {
  IMarketTokenSelectorColumns,
  IMarketTokenSelectorMetricColumn,
} from './constants';
import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';
import type { IMarketTimeRangeValue } from '../../../MarketHomeV2/types';

type IMarketTokenSelectorItem = IMarketToken & {
  selectorSubtitle?: string;
  tokenDetailPreview?: IMarketTokenDetailPreview;
};

interface IMarketTokenSelectorListProps {
  networkId: string;
  selectedCategory?: string;
  timeRange?: IMarketTimeRangeValue;
  onItemPress: (item: IMarketTokenSelectorItem) => void;
  pollingInterval?: number;
  isWatchlistMode?: boolean;
  searchQuery?: string;
  searchLoading?: boolean;
  searchResults?: (IMarketSearchV2Token & { networkLogoURI: string })[];
  dataOverride?: IMarketTokenSelectorItem[];
  dataOverrideLoading?: boolean;
}

// Shared ListView renderer to eliminate duplication across list variants
function TokenSelectorListView({
  data,
  isLoading,
  networkId,
  onItemPress,
  emptyMessage,
  showAddress = true,
  columns,
}: {
  data: IMarketTokenSelectorItem[];
  isLoading?: boolean;
  networkId: string;
  onItemPress: (item: IMarketTokenSelectorItem) => void;
  emptyMessage?: string;
  showAddress?: boolean;
  columns: IMarketTokenSelectorColumns;
}) {
  if (isLoading && data.length === 0) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center">
        <Spinner size="large" />
      </YStack>
    );
  }

  if (!isLoading && data.length === 0 && emptyMessage) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center">
        <Empty illustration="QuestionMark" title={emptyMessage} />
      </YStack>
    );
  }

  return (
    <ListView
      estimatedItemSize={TOKEN_SELECTOR_ROW_HEIGHT}
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <MarketTokenSelectorRow
          item={item}
          networkId={networkId}
          onPress={onItemPress}
          showAddress={showAddress}
          columns={columns}
        />
      )}
      contentContainerStyle={{ paddingBottom: 10 }}
    />
  );
}

const WatchlistTokenSelectorList = memo(
  ({
    networkId,
    onItemPress,
    pollingInterval,
    columns,
  }: {
    networkId: string;
    onItemPress: (item: IMarketTokenSelectorItem) => void;
    pollingInterval?: number;
    columns: IMarketTokenSelectorColumns;
  }) => {
    const intl = useIntl();
    const [{ data: watchListData }] = useMarketWatchListV2Atom();

    const { data, isLoading } = useMarketWatchlistTokenList({
      watchlist: watchListData ?? [],
      pollingInterval: pollingInterval ?? TOKEN_SELECTOR_POLLING_INTERVAL,
    });

    const filteredData = useMemo(
      () => data.filter((item) => !item.perpsCoin),
      [data],
    );

    return (
      <TokenSelectorListView
        data={filteredData}
        isLoading={isLoading}
        networkId={networkId}
        onItemPress={onItemPress}
        emptyMessage={intl.formatMessage({
          id: ETranslations.market_favorites_empty,
        })}
        columns={columns}
      />
    );
  },
);

WatchlistTokenSelectorList.displayName = 'WatchlistTokenSelectorList';

const CategoryTokenSelectorList = memo(
  ({
    networkId,
    selectedCategory,
    timeRange,
    onItemPress,
    pollingInterval,
    columns,
  }: {
    networkId: string;
    selectedCategory?: string;
    timeRange?: IMarketTimeRangeValue;
    onItemPress: (item: IMarketTokenSelectorItem) => void;
    pollingInterval?: number;
    columns: IMarketTokenSelectorColumns;
  }) => {
    const { data, isLoading } = useMarketTokenList({
      networkId,
      type: selectedCategory,
      timeRange,
      pollingInterval: pollingInterval ?? TOKEN_SELECTOR_POLLING_INTERVAL,
    });

    return (
      <TokenSelectorListView
        data={data}
        isLoading={isLoading}
        networkId={networkId}
        onItemPress={onItemPress}
        columns={columns}
      />
    );
  },
);

CategoryTokenSelectorList.displayName = 'CategoryTokenSelectorList';

const SearchTokenSelectorList = memo(
  ({
    searchResults,
    searchLoading,
    onItemPress,
    networkId,
    columns,
  }: {
    searchResults: (IMarketSearchV2Token & { networkLogoURI: string })[];
    searchLoading?: boolean;
    onItemPress: (item: IMarketTokenSelectorItem) => void;
    networkId: string;
    columns: IMarketTokenSelectorColumns;
  }) => {
    const intl = useIntl();
    const data = useMemo(
      () =>
        searchResults.map((item) => ({
          ...convertSearchTokenToMarketToken(item),
          tokenDetailPreview: buildMarketSearchTokenDetailPreview(item),
        })),
      [searchResults],
    );

    return (
      <TokenSelectorListView
        data={data}
        isLoading={searchLoading}
        networkId={networkId}
        onItemPress={onItemPress}
        emptyMessage={intl.formatMessage({
          id: ETranslations.global_no_results,
        })}
        columns={columns}
      />
    );
  },
);

SearchTokenSelectorList.displayName = 'SearchTokenSelectorList';

function ListContent({
  searchQuery,
  searchResults,
  searchLoading,
  isWatchlistMode,
  networkId,
  onItemPress,
  pollingInterval,
  selectedCategory,
  timeRange,
  dataOverride,
  dataOverrideLoading,
  columns,
}: IMarketTokenSelectorListProps & { columns: IMarketTokenSelectorColumns }) {
  if (searchQuery) {
    return (
      <SearchTokenSelectorList
        searchResults={searchResults ?? []}
        searchLoading={searchLoading}
        onItemPress={onItemPress}
        networkId={networkId}
        columns={columns}
      />
    );
  }
  if (isWatchlistMode) {
    return (
      <WatchlistTokenSelectorList
        networkId={networkId}
        onItemPress={onItemPress}
        pollingInterval={pollingInterval}
        columns={columns}
      />
    );
  }
  if (dataOverride) {
    return (
      <TokenSelectorListView
        data={dataOverride}
        isLoading={dataOverrideLoading}
        networkId={networkId}
        onItemPress={onItemPress}
        showAddress={false}
        columns={columns}
      />
    );
  }
  return (
    <CategoryTokenSelectorList
      networkId={networkId}
      selectedCategory={selectedCategory}
      timeRange={timeRange}
      onItemPress={onItemPress}
      pollingInterval={pollingInterval}
      columns={columns}
    />
  );
}

const MarketTokenSelectorList = memo(
  ({
    networkId,
    selectedCategory,
    timeRange,
    onItemPress,
    pollingInterval,
    isWatchlistMode,
    searchQuery,
    searchLoading,
    searchResults,
    dataOverride,
    dataOverrideLoading,
  }: IMarketTokenSelectorListProps) => {
    const intl = useIntl();

    // Only the v2 category list honours the requested time frame; the
    // watchlist, top coins and search payloads always carry 24h metrics.
    const isCategoryList = !searchQuery && !isWatchlistMode && !dataOverride;
    const metricsTimeRange: IMarketTimeRangeValue = isCategoryList
      ? (timeRange ?? '24h')
      : '24h';

    const columns = useMemo<IMarketTokenSelectorColumns>(() => {
      const metrics =
        TOKEN_SELECTOR_METRIC_COLUMNS[isCategoryList ? 'trending' : 'coins'];
      return {
        ...getTokenSelectorColumnWidths(metrics.length),
        metrics,
      };
    }, [isCategoryList]);

    const metricTitles = useMemo<
      Record<IMarketTokenSelectorMetricColumn, string>
    >(
      () => ({
        price: intl.formatMessage({ id: ETranslations.global_price }),
        // Time-scoped labels follow the MarketHomeV2 trending table: the range
        // is prefixed to the translated metric word.
        change: `${metricsTimeRange} ${intl.formatMessage({
          id: ETranslations.dexmarket_token_change,
        })}`,
        marketCap: intl.formatMessage({ id: ETranslations.global_market_cap }),
        liquidity: intl.formatMessage({ id: ETranslations.global_liquidity }),
        turnover: `${metricsTimeRange} ${intl.formatMessage({
          id: ETranslations.perp_token_selector_volume,
        })}`,
      }),
      [intl, metricsTimeRange],
    );

    return (
      <YStack flex={1}>
        {/* Fixed header */}
        <XStack
          width="100%"
          height={TOKEN_SELECTOR_HEADER_HEIGHT}
          alignItems="center"
        >
          <XStack
            width={columns.nameColumnWidth}
            px={TOKEN_SELECTOR_COLUMN_PADDING}
            alignItems="center"
            gap={TOKEN_SELECTOR_NAME_GAP}
          >
            <SizableText
              width={TOKEN_SELECTOR_STAR_COLUMN_WIDTH}
              textAlign="center"
              size="$bodySmMedium"
              color="$textSubdued"
            >
              #
            </SizableText>
            <SizableText size="$bodySmMedium" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.global_name })}
            </SizableText>
          </XStack>
          {columns.metrics.map((metric) => (
            <XStack
              key={metric}
              width={columns.metricColumnWidth}
              px={TOKEN_SELECTOR_COLUMN_PADDING}
              alignItems="center"
            >
              <SizableText
                size="$bodySmMedium"
                color="$textSubdued"
                numberOfLines={1}
              >
                {metricTitles[metric]}
              </SizableText>
            </XStack>
          ))}
        </XStack>

        {/* Scrollable list */}
        <YStack height={350}>
          <ListContent
            searchQuery={searchQuery}
            searchResults={searchResults}
            searchLoading={searchLoading}
            isWatchlistMode={isWatchlistMode}
            networkId={networkId}
            onItemPress={onItemPress}
            pollingInterval={pollingInterval}
            selectedCategory={selectedCategory}
            timeRange={timeRange}
            dataOverride={dataOverride}
            dataOverrideLoading={dataOverrideLoading}
            columns={columns}
          />
        </YStack>
      </YStack>
    );
  },
);

MarketTokenSelectorList.displayName = 'MarketTokenSelectorList';

export { MarketTokenSelectorList };
export type { IMarketTokenSelectorListProps };
