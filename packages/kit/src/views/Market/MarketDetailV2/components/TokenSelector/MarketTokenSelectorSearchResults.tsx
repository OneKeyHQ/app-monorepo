import { memo, useCallback, useEffect, useMemo, useState } from 'react';

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
import {
  type IMarketTokenSelectorSearchTab,
  MarketTokenSelectorSearchTabs,
} from './MarketTokenSelectorSearchTabs';
import { useMarketStockSelectorList } from './useMarketStockSelectorList';

const SEARCH_RESULTS_HEIGHT = 390;
const SEARCH_SECTION_PREVIEW_LIMIT = 3;

type IMarketSearchToken = IMarketSearchV2Token & {
  networkLogoURI: string;
};
type IMarketSearchResultToken = IMarketToken & {
  tokenDetailPreview?: IMarketTokenDetailPreview;
};

function SearchSectionTitle({ title }: { title: string }) {
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
      alignSelf="flex-start"
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
  showAll,
  onShowAll,
  onRetry,
  onPress,
}: {
  items: IMarketStockPublicItem[];
  isLoading: boolean;
  isError: boolean;
  showAll: boolean;
  onShowAll: () => void;
  onRetry: () => void;
  onPress: (item: IMarketStockPublicItem) => void;
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
      <SearchSectionTitle
        title={intl.formatMessage({
          id: ETranslations.perps_token_selector_stocks,
        })}
      />
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
      {!showAll && items.length > SEARCH_SECTION_PREVIEW_LIMIT ? (
        <SearchMoreButton
          testID="market-token-selector-stock-search-show-more"
          onPress={onShowAll}
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
}: {
  items: IMarketSearchResultToken[];
  isLoading?: boolean;
  showAll: boolean;
  onShowAll: () => void;
  onPress: (item: IMarketSearchResultToken) => void;
}) {
  const intl = useIntl();
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
      <SearchSectionTitle
        title={intl.formatMessage({ id: ETranslations.global_market })}
      />
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
  const [activeTab, setActiveTab] =
    useState<IMarketTokenSelectorSearchTab>('all');
  const [showAllStocks, setShowAllStocks] = useState(false);
  const [showAllMarkets, setShowAllMarkets] = useState(false);
  const stockResult = useMarketStockSelectorList({ query });
  const convertedMarketItems = useMemo(
    () =>
      marketItems.map((item) => ({
        ...convertSearchTokenToMarketToken(item),
        tokenDetailPreview: buildMarketSearchTokenDetailPreview(item),
      })),
    [marketItems],
  );

  useEffect(() => {
    setActiveTab('all');
    setShowAllStocks(false);
    setShowAllMarkets(false);
  }, [query]);

  const showStockSection =
    activeTab !== 'market' &&
    (stockResult.isLoading ||
      stockResult.isError ||
      stockResult.items.length > 0);
  const showMarketSection =
    activeTab !== 'stocks' &&
    (Boolean(isMarketLoading) || convertedMarketItems.length > 0);

  return (
    <YStack height={SEARCH_RESULTS_HEIGHT}>
      <MarketTokenSelectorSearchTabs
        value={activeTab}
        onChange={setActiveTab}
      />
      {!showStockSection && !showMarketSection ? (
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
              showAll={activeTab === 'stocks' || showAllStocks}
              onShowAll={() => setShowAllStocks(true)}
              onRetry={() => void stockResult.refresh()}
              onPress={onStockPress}
            />
          ) : null}
          {showMarketSection ? (
            <MarketSearchSection
              items={convertedMarketItems}
              isLoading={isMarketLoading}
              showAll={activeTab === 'market' || showAllMarkets}
              onShowAll={() => setShowAllMarkets(true)}
              onPress={onMarketPress}
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
