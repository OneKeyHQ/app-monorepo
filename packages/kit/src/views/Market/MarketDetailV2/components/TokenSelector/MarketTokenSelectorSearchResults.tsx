import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Empty,
  ScrollView,
  SizableText,
  Spinner,
  Table,
  YStack,
} from '@onekeyhq/components';
import { useMarketStockColumns } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/useMarketStockColumns';
import { useMarketTokenColumns } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenColumns';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import { isDetailSearchChainToken } from '@onekeyhq/kit/src/views/Market/utils/marketSearchList';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';
import type {
  IMarketStockPublicItem,
  IMarketTokenDetailPreview,
} from '@onekeyhq/shared/types/marketV2';

import { buildMarketSearchTokenDetailPreview } from '../../utils/marketDetailPreview';

import {
  TOKEN_SELECTOR_HEADER_HEIGHT,
  TOKEN_SELECTOR_HIDDEN_DESKTOP_COLUMNS,
  TOKEN_SELECTOR_ROW_HEIGHT,
  convertSearchTokenToMarketToken,
} from './constants';
import { MarketTokenSelectorSearchTabs } from './MarketTokenSelectorSearchTabs';
import {
  MARKET_SEARCH_TABS,
  useMarketTokenSelectorSearchState,
} from './useMarketTokenSelectorSearchState';

const SEARCH_RESULTS_HEIGHT = 390;
const SEARCH_SECTION_PREVIEW_LIMIT = 3;

type IMarketSearchToken = IMarketSearchV2Token & {
  networkLogoURI: string;
};
type IMarketSearchResultToken = IMarketToken & {
  tokenDetailPreview?: IMarketTokenDetailPreview;
};

function SearchSectionTitle({ title }: { title?: string }) {
  if (!title) {
    return null;
  }
  return (
    <SizableText px="$3" py="$2" size="$headingSm">
      {title}
    </SizableText>
  );
}

function SearchMoreButton({
  testID,
  onPress,
}: {
  testID: string;
  onPress: () => void;
}) {
  const intl = useIntl();
  return (
    <Button
      testID={testID}
      alignSelf="center"
      mx="$0"
      my="$2"
      size="small"
      variant="tertiary"
      onPress={onPress}
    >
      {intl.formatMessage({ id: ETranslations.global_show_more })}
    </Button>
  );
}

function SearchSectionLoading() {
  return (
    <YStack height="$24" alignItems="center" justifyContent="center">
      <Spinner size="large" />
    </YStack>
  );
}

function StockSearchSection({
  items,
  isLoading,
  isError,
  isLoadingMore,
  isLoadMoreError,
  canLoadMore,
  showAll,
  onShowAll,
  onLoadMore,
  onRetry,
  onPress,
  title,
}: {
  items: IMarketStockPublicItem[];
  isLoading: boolean;
  isError: boolean;
  isLoadingMore: boolean;
  isLoadMoreError: boolean;
  canLoadMore: boolean;
  showAll: boolean;
  onShowAll: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onPress: (item: IMarketStockPublicItem) => void;
  title?: string;
}) {
  const intl = useIntl();
  const columns = useMarketStockColumns({
    compact: true,
    showSparkline: false,
    showWatchlist: true,
    showMarketTags: true,
    watchlistFrom: EWatchlistFrom.Search,
  });
  const visibleItems = showAll
    ? items
    : items.slice(0, SEARCH_SECTION_PREVIEW_LIMIT);
  const tableHeight =
    TOKEN_SELECTOR_HEADER_HEIGHT +
    visibleItems.length * TOKEN_SELECTOR_ROW_HEIGHT;
  const onRow = useCallback(
    (item: IMarketStockPublicItem) => ({ onPress: () => onPress(item) }),
    [onPress],
  );

  return (
    <YStack>
      <SearchSectionTitle title={title} />
      {isLoading && items.length === 0 ? <SearchSectionLoading /> : null}
      {isError && items.length === 0 ? (
        <YStack py="$4" alignItems="center" gap="$2">
          <SizableText color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.global_connet_error_try_again,
            })}
          </SizableText>
          <Button
            testID="market-token-selector-stock-search-retry"
            size="small"
            variant="tertiary"
            onPress={onRetry}
          >
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        </YStack>
      ) : null}
      {visibleItems.length > 0 ? (
        <YStack height={tableHeight}>
          <Table<IMarketStockPublicItem>
            stickyHeader
            scrollEnabled={false}
            columns={columns}
            dataSource={visibleItems}
            keyExtractor={(item) => item.stockId}
            estimatedItemSize={TOKEN_SELECTOR_ROW_HEIGHT}
            rowProps={{
              bg: '$bg',
              width: '100%',
              height: TOKEN_SELECTOR_ROW_HEIGHT,
              minHeight: TOKEN_SELECTOR_ROW_HEIGHT,
              borderRadius: '$0',
            }}
            headerRowProps={{
              height: TOKEN_SELECTOR_HEADER_HEIGHT,
              minHeight: TOKEN_SELECTOR_HEADER_HEIGHT,
            }}
            onRow={onRow}
          />
        </YStack>
      ) : null}
      {!showAll &&
      (items.length > SEARCH_SECTION_PREVIEW_LIMIT || canLoadMore) ? (
        <SearchMoreButton
          testID="market-token-selector-stock-search-show-more"
          onPress={onShowAll}
        />
      ) : null}
      {showAll && isLoadingMore ? (
        <YStack py="$4" alignItems="center">
          <Spinner size="small" />
        </YStack>
      ) : null}
      {showAll && isLoadMoreError ? (
        <Button
          testID="market-token-selector-stock-search-load-more-retry"
          alignSelf="flex-start"
          size="small"
          variant="tertiary"
          onPress={onLoadMore}
        >
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      ) : null}
      {showAll && canLoadMore && !isLoadingMore && !isLoadMoreError ? (
        <SearchMoreButton
          testID="market-token-selector-stock-search-load-more"
          onPress={onLoadMore}
        />
      ) : null}
    </YStack>
  );
}

function MarketSearchSection({
  items,
  isLoading,
  showAll,
  onShowAll,
  onPress,
  title,
}: {
  items: IMarketSearchResultToken[];
  isLoading?: boolean;
  showAll: boolean;
  onShowAll: () => void;
  onPress: (item: IMarketSearchResultToken) => void;
  title?: string;
}) {
  const columns = useMarketTokenColumns(
    undefined,
    false,
    true,
    EWatchlistFrom.Search,
    undefined,
    true,
    true,
    TOKEN_SELECTOR_HIDDEN_DESKTOP_COLUMNS,
  );
  const visibleItems = showAll
    ? items
    : items.slice(0, SEARCH_SECTION_PREVIEW_LIMIT);
  const tableHeight =
    TOKEN_SELECTOR_HEADER_HEIGHT +
    visibleItems.length * TOKEN_SELECTOR_ROW_HEIGHT;
  const onRow = useCallback(
    (item: IMarketSearchResultToken) => ({ onPress: () => onPress(item) }),
    [onPress],
  );

  return (
    <YStack>
      <SearchSectionTitle title={title} />
      {isLoading && items.length === 0 ? <SearchSectionLoading /> : null}
      {visibleItems.length > 0 ? (
        <YStack height={tableHeight}>
          <Table<IMarketSearchResultToken>
            stickyHeader
            scrollEnabled={false}
            columns={columns}
            dataSource={visibleItems}
            keyExtractor={(item) => item.id}
            estimatedItemSize={TOKEN_SELECTOR_ROW_HEIGHT}
            rowProps={{
              bg: '$bg',
              width: '100%',
              height: TOKEN_SELECTOR_ROW_HEIGHT,
              minHeight: TOKEN_SELECTOR_ROW_HEIGHT,
              borderRadius: '$0',
            }}
            headerRowProps={{
              height: TOKEN_SELECTOR_HEADER_HEIGHT,
              minHeight: TOKEN_SELECTOR_HEADER_HEIGHT,
            }}
            onRow={onRow}
          />
        </YStack>
      ) : null}
      {!showAll && items.length > SEARCH_SECTION_PREVIEW_LIMIT ? (
        <SearchMoreButton
          testID="market-token-selector-market-search-show-more"
          onPress={onShowAll}
        />
      ) : null}
    </YStack>
  );
}

function MarketTokenSelectorSearchResults({
  query,
  marketItems,
  isMarketLoading,
  onStockPress,
  onMarketPress,
}: {
  query: string;
  marketItems: IMarketSearchToken[];
  isMarketLoading?: boolean;
  onStockPress: (item: IMarketStockPublicItem) => void;
  onMarketPress: (item: IMarketSearchResultToken) => void;
}) {
  const intl = useIntl();
  const {
    activeTab,
    setActiveTab,
    showAllStocks,
    setShowAllStocks,
    showAllTokens,
    setShowAllTokens,
    stockResult,
    hasStockResults,
    showSectionTitle,
  } = useMarketTokenSelectorSearchState(query);
  const chainTokenItems = useMemo(
    () =>
      marketItems
        .filter((item) => isDetailSearchChainToken(item))
        .map((item) => ({
          ...convertSearchTokenToMarketToken(item),
          tokenDetailPreview: buildMarketSearchTokenDetailPreview(item),
        })),
    [marketItems],
  );
  const isAllTab = activeTab === MARKET_SEARCH_TABS.all;
  const isStocksTab = activeTab === MARKET_SEARCH_TABS.stocks;
  const isTokensTab = activeTab === MARKET_SEARCH_TABS.tokens;
  const showStockSection =
    (isAllTab || isStocksTab) &&
    (hasStockResults || stockResult.isLoading || stockResult.isError);
  const showTokenSection =
    (isAllTab || isTokensTab) &&
    (Boolean(isMarketLoading) || chainTokenItems.length > 0);

  return (
    <YStack height={SEARCH_RESULTS_HEIGHT}>
      <MarketTokenSelectorSearchTabs
        value={activeTab}
        onChange={setActiveTab}
        hasStockResults={hasStockResults}
      />
      {!showStockSection && !showTokenSection ? (
        <YStack flex={1} alignItems="center" justifyContent="center">
          <Empty
            illustration="QuestionMark"
            title={intl.formatMessage({ id: ETranslations.global_no_results })}
          />
        </YStack>
      ) : (
        <ScrollView flex={1}>
          {showStockSection ? (
            <StockSearchSection
              items={stockResult.items}
              isLoading={stockResult.isLoading}
              isError={stockResult.isError}
              isLoadingMore={stockResult.isLoadingMore}
              isLoadMoreError={stockResult.isLoadMoreError}
              canLoadMore={stockResult.canLoadMore}
              showAll={isStocksTab || showAllStocks}
              onShowAll={() => setShowAllStocks(true)}
              onLoadMore={() => void stockResult.loadMore()}
              onRetry={() => void stockResult.refresh()}
              onPress={onStockPress}
              title={
                showSectionTitle
                  ? intl.formatMessage({
                      id: ETranslations.perps_token_selector_stocks,
                    })
                  : undefined
              }
            />
          ) : null}
          {showTokenSection ? (
            <MarketSearchSection
              items={chainTokenItems}
              isLoading={isMarketLoading}
              showAll={isTokensTab || showAllTokens}
              onShowAll={() => setShowAllTokens(true)}
              onPress={onMarketPress}
              title={
                showSectionTitle
                  ? intl.formatMessage({
                      id: ETranslations.global_universal_search_tabs_tokens,
                    })
                  : undefined
              }
            />
          ) : null}
        </ScrollView>
      )}
    </YStack>
  );
}

const MemoMarketTokenSelectorSearchResults = memo(
  MarketTokenSelectorSearchResults,
);

export { MemoMarketTokenSelectorSearchResults as MarketTokenSelectorSearchResults };
