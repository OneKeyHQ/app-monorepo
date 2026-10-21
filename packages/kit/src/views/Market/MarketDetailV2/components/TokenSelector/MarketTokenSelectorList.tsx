import { memo, useMemo } from 'react';
import type { ReactElement, RefObject } from 'react';

import { useIntl } from 'react-intl';

import { Button, Empty, ListView, Spinner, YStack } from '@onekeyhq/components';
import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';
import type { IMarketTokenDetailPreview } from '@onekeyhq/shared/types/marketV2';

import { useMarketTokenList } from '../../../MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenList';
import {
  type IMarketWatchlistDataCache,
  useMarketWatchlistTokenList,
} from '../../../MarketHomeV2/components/MarketTokenList/hooks/useMarketWatchlistTokenList';
import { useWatchlistFilteredGroups } from '../../../MarketHomeV2/components/MarketTokenList/hooks/useWatchlistFilteredGroups';
import { isTrendingStyleSpotCategory } from '../../../MarketHomeV2/utils';
import { buildMarketSearchTokenDetailPreview } from '../../utils/marketDetailPreview';

import {
  TOKEN_SELECTOR_LIST_PADDING_BOTTOM,
  TOKEN_SELECTOR_METRIC_COLUMNS,
  TOKEN_SELECTOR_METRIC_FLEX,
  TOKEN_SELECTOR_POLLING_INTERVAL,
  TOKEN_SELECTOR_ROW_HEIGHT,
  TOKEN_SELECTOR_TABLE_PADDING,
  convertSearchTokenToMarketToken,
} from './constants';
import { MarketTokenSelectorRow } from './MarketTokenSelectorRow';
import { SelectorTableHeader } from './selectorTable';
import { SelectorWatchlistRecommendations } from './SelectorWatchlistRecommendations';

import type {
  IMarketTokenSelectorColumnVariant,
  IMarketTokenSelectorColumns,
  IMarketTokenSelectorMetricColumn,
} from './constants';
import type { IDetailSelectorWatchlistFilter } from './detailSelectorBrowse';
import type { IMarketTokenSelectorSubtitleVariant } from './MarketTokenSelectorRow';
import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';
import type { IMarketTimeRangeValue } from '../../../MarketHomeV2/types';

type IMarketTokenSelectorItem = IMarketToken & {
  selectorSubtitle?: string;
  tokenDetailPreview?: IMarketTokenDetailPreview;
};

// `VirtualizedList` (web/desktop/extension) maps sticky index 0 onto
// `ListHeaderComponent`, which is what pins the column header while scrolling.
// FlashList (native) instead indexes into `data`, so passing [0] there would
// pin the first token row; native simply scrolls the header away. Either way
// the header lives in the same content box as the rows, which is what keeps the
// percentage columns aligned once a vertical scrollbar takes layout width.
const TOKEN_SELECTOR_STICKY_HEADER_INDICES = platformEnv.isNative
  ? undefined
  : [0];

interface IMarketTokenSelectorListProps {
  networkId: string;
  selectedCategory?: string;
  timeRange?: IMarketTimeRangeValue;
  onItemPress: (item: IMarketTokenSelectorItem) => void;
  pollingInterval?: number;
  isWatchlistMode?: boolean;
  watchlistFilter?: IDetailSelectorWatchlistFilter;
  // Owned by the selector shell so favorites data survives a tab switch, which
  // unmounts this list.
  watchlistDataCacheRef?: RefObject<IMarketWatchlistDataCache | undefined>;
  searchQuery?: string;
  searchLoading?: boolean;
  searchResults?: (IMarketSearchV2Token & { networkLogoURI: string })[];
  dataOverride?: IMarketTokenSelectorItem[];
  dataOverrideLoading?: boolean;
  dataOverrideError?: boolean;
  onDataOverrideRetry?: () => void;
}

// Shared ListView renderer to eliminate duplication across list variants
function TokenSelectorListView({
  data,
  isLoading,
  networkId,
  onItemPress,
  emptyMessage,
  subtitleVariant = 'name',
  columns,
  listHeader,
  isError,
  onRetry,
}: {
  data: IMarketTokenSelectorItem[];
  isLoading?: boolean;
  /** A failed first load with nothing to show offers a retry. */
  isError?: boolean;
  onRetry?: () => void;
  networkId: string;
  onItemPress: (item: IMarketTokenSelectorItem) => void;
  emptyMessage?: string;
  subtitleVariant?: IMarketTokenSelectorSubtitleVariant;
  columns: IMarketTokenSelectorColumns;
  listHeader: ReactElement;
}) {
  const intl = useIntl();
  // The loading and empty states are not lists, so they carry the header
  // themselves — it must never disappear while a tab is switching or empty.
  if (isLoading && data.length === 0) {
    return (
      <YStack flex={1} px={TOKEN_SELECTOR_TABLE_PADDING}>
        {listHeader}
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" />
        </YStack>
      </YStack>
    );
  }

  if (isError && data.length === 0 && onRetry) {
    return (
      <YStack flex={1} px={TOKEN_SELECTOR_TABLE_PADDING}>
        {listHeader}
        <YStack flex={1} alignItems="center" justifyContent="center" gap="$2">
          <Empty
            illustration="QuestionMark"
            title={intl.formatMessage({
              id: ETranslations.global_connet_error_try_again,
            })}
          />
          <Button
            testID="market-token-selector-list-retry"
            size="small"
            variant="secondary"
            onPress={onRetry}
          >
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        </YStack>
      </YStack>
    );
  }

  if (!isLoading && data.length === 0 && emptyMessage) {
    return (
      <YStack flex={1} px={TOKEN_SELECTOR_TABLE_PADDING}>
        {listHeader}
        <YStack flex={1} alignItems="center" justifyContent="center">
          <Empty illustration="QuestionMark" title={emptyMessage} />
        </YStack>
      </YStack>
    );
  }

  return (
    <ListView
      estimatedItemSize={TOKEN_SELECTOR_ROW_HEIGHT}
      data={data}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={listHeader}
      stickyHeaderIndices={TOKEN_SELECTOR_STICKY_HEADER_INDICES}
      renderItem={({ item }) => (
        <MarketTokenSelectorRow
          item={item}
          networkId={networkId}
          onPress={onItemPress}
          subtitleVariant={subtitleVariant}
          columns={columns}
        />
      )}
      contentContainerStyle={{
        paddingHorizontal: TOKEN_SELECTOR_TABLE_PADDING,
        paddingBottom: TOKEN_SELECTOR_LIST_PADDING_BOTTOM,
      }}
    />
  );
}

const WatchlistTokenSelectorList = memo(
  ({
    watchlistFilter = 'all',
    networkId,
    onItemPress,
    pollingInterval,
    columns,
    listHeader,
    dataCacheRef,
  }: {
    watchlistFilter?: IDetailSelectorWatchlistFilter;
    networkId: string;
    onItemPress: (item: IMarketTokenSelectorItem) => void;
    pollingInterval?: number;
    columns: IMarketTokenSelectorColumns;
    listHeader: ReactElement;
    dataCacheRef?: RefObject<IMarketWatchlistDataCache | undefined>;
  }) => {
    const intl = useIntl();
    const [{ data: watchListData, isMounted }] = useMarketWatchListV2Atom();

    const { data, isLoading, isError, refetch } = useMarketWatchlistTokenList({
      watchlist: watchListData ?? [],
      pageSize: Math.max(watchListData?.length ?? 0, 1),
      pollingInterval: pollingInterval ?? TOKEN_SELECTOR_POLLING_INTERVAL,
      dataCacheRef,
    });

    const groups = useWatchlistFilteredGroups(data, { hidePerps: true });
    const filteredData = groups[watchlistFilter];

    if (
      isMounted &&
      !isLoading &&
      !isError &&
      groups.all.length === 0 &&
      watchlistFilter !== 'stocks'
    ) {
      return <SelectorWatchlistRecommendations />;
    }

    return (
      <TokenSelectorListView
        data={filteredData}
        isLoading={!isMounted || isLoading}
        networkId={networkId}
        onItemPress={onItemPress}
        emptyMessage={intl.formatMessage({
          id: ETranslations.global_no_results,
        })}
        columns={columns}
        listHeader={listHeader}
        isError={isError}
        onRetry={() => void refetch()}
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
    listHeader,
  }: {
    networkId: string;
    selectedCategory?: string;
    timeRange?: IMarketTimeRangeValue;
    onItemPress: (item: IMarketTokenSelectorItem) => void;
    pollingInterval?: number;
    columns: IMarketTokenSelectorColumns;
    listHeader: ReactElement;
  }) => {
    const { data, isLoading, isError, refetch } = useMarketTokenList({
      networkId,
      type: selectedCategory,
      // Same request as the desktop Market home tab: Trending-style lists rank
      // by the API's own order instead of a client sort field.
      useApiDefaultSort: isTrendingStyleSpotCategory(selectedCategory),
      timeRange,
      pollingInterval: pollingInterval ?? TOKEN_SELECTOR_POLLING_INTERVAL,
    });

    return (
      <TokenSelectorListView
        data={data}
        isLoading={isLoading}
        networkId={networkId}
        onItemPress={onItemPress}
        subtitleVariant="ageAddress"
        columns={columns}
        listHeader={listHeader}
        isError={isError}
        onRetry={() => void refetch()}
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
    listHeader,
  }: {
    searchResults: (IMarketSearchV2Token & { networkLogoURI: string })[];
    searchLoading?: boolean;
    onItemPress: (item: IMarketTokenSelectorItem) => void;
    networkId: string;
    columns: IMarketTokenSelectorColumns;
    listHeader: ReactElement;
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
        listHeader={listHeader}
      />
    );
  },
);

SearchTokenSelectorList.displayName = 'SearchTokenSelectorList';

function ListContent({
  watchlistFilter,
  searchQuery,
  searchResults,
  searchLoading,
  isWatchlistMode,
  watchlistDataCacheRef,
  networkId,
  onItemPress,
  pollingInterval,
  selectedCategory,
  timeRange,
  dataOverride,
  dataOverrideLoading,
  dataOverrideError,
  onDataOverrideRetry,
  columns,
  listHeader,
}: IMarketTokenSelectorListProps & {
  columns: IMarketTokenSelectorColumns;
  listHeader: ReactElement;
}) {
  if (searchQuery) {
    return (
      <SearchTokenSelectorList
        searchResults={searchResults ?? []}
        searchLoading={searchLoading}
        onItemPress={onItemPress}
        networkId={networkId}
        columns={columns}
        listHeader={listHeader}
      />
    );
  }
  if (isWatchlistMode) {
    return (
      <WatchlistTokenSelectorList
        watchlistFilter={watchlistFilter}
        networkId={networkId}
        onItemPress={onItemPress}
        pollingInterval={pollingInterval}
        columns={columns}
        listHeader={listHeader}
        dataCacheRef={watchlistDataCacheRef}
      />
    );
  }
  if (dataOverride) {
    return (
      <TokenSelectorListView
        data={dataOverride}
        isLoading={dataOverrideLoading}
        isError={dataOverrideError}
        onRetry={onDataOverrideRetry}
        networkId={networkId}
        onItemPress={onItemPress}
        columns={columns}
        listHeader={listHeader}
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
      listHeader={listHeader}
    />
  );
}

const MarketTokenSelectorList = memo(
  ({
    watchlistFilter,
    networkId,
    selectedCategory,
    timeRange,
    onItemPress,
    pollingInterval,
    isWatchlistMode,
    watchlistDataCacheRef,
    searchQuery,
    searchLoading,
    searchResults,
    dataOverride,
    dataOverrideLoading,
    dataOverrideError,
    onDataOverrideRetry,
  }: IMarketTokenSelectorListProps) => {
    const intl = useIntl();

    // Only the v2 category list honours the requested time frame; the
    // watchlist, top coins and search payloads always carry 24h metrics.
    const isCategoryList = !searchQuery && !isWatchlistMode && !dataOverride;
    const metricsTimeRange: IMarketTimeRangeValue = isCategoryList
      ? (timeRange ?? '24h')
      : '24h';
    let columnVariant: IMarketTokenSelectorColumnVariant = 'coins';
    if (isCategoryList) {
      columnVariant = 'trending';
    } else if (isWatchlistMode && !searchQuery) {
      columnVariant = 'favorites';
    }

    const columns = useMemo<IMarketTokenSelectorColumns>(
      () => ({
        metrics: TOKEN_SELECTOR_METRIC_COLUMNS[columnVariant],
        flex: TOKEN_SELECTOR_METRIC_FLEX[columnVariant],
      }),
      [columnVariant],
    );

    const metricTitles = useMemo<
      Record<IMarketTokenSelectorMetricColumn, string>
    >(
      () => ({
        price: intl.formatMessage({ id: ETranslations.global_price }),
        // Time-scoped labels follow the MarketHomeV2 trending table: the range
        // is interpolated into the translated metric phrase.
        change: intl.formatMessage(
          { id: ETranslations.market_change_in_range },
          { range: metricsTimeRange },
        ),
        priceChange: `${intl.formatMessage({
          id: ETranslations.global_price,
        })} / ${intl.formatMessage(
          { id: ETranslations.market_change_in_range },
          { range: metricsTimeRange },
        )}`,
        marketCap: intl.formatMessage({ id: ETranslations.global_market_cap }),
        liquidity: intl.formatMessage({ id: ETranslations.global_liquidity }),
        turnover: intl.formatMessage(
          { id: ETranslations.market_volume_in_range },
          { range: metricsTimeRange },
        ),
      }),
      [intl, metricsTimeRange],
    );

    // Rendered inside the scroll container as the list header so it shares the
    // rows' content box. A vertical scrollbar that takes layout width (Windows
    // desktop, browser extension) then shrinks header and rows by the same
    // amount and the flex columns stay aligned.
    const listHeader = useMemo(
      () => (
        <SelectorTableHeader
          nameTitle={intl.formatMessage({ id: ETranslations.global_name })}
          cells={columns.metrics.map((metric) => ({
            key: metric,
            label: metricTitles[metric],
            flex: columns.flex[metric],
          }))}
        />
      ),
      [columns, intl, metricTitles],
    );

    return (
      // Fills the popover body below the tabs and chips.
      <YStack flex={1}>
        <ListContent
          watchlistFilter={watchlistFilter}
          searchQuery={searchQuery}
          searchResults={searchResults}
          searchLoading={searchLoading}
          isWatchlistMode={isWatchlistMode}
          watchlistDataCacheRef={watchlistDataCacheRef}
          networkId={networkId}
          onItemPress={onItemPress}
          pollingInterval={pollingInterval}
          selectedCategory={selectedCategory}
          timeRange={timeRange}
          dataOverride={dataOverride}
          dataOverrideLoading={dataOverrideLoading}
          dataOverrideError={dataOverrideError}
          onDataOverrideRetry={onDataOverrideRetry}
          columns={columns}
          listHeader={listHeader}
        />
      </YStack>
    );
  },
);

MarketTokenSelectorList.displayName = 'MarketTokenSelectorList';

export { MarketTokenSelectorList };
export type { IMarketTokenSelectorListProps };
