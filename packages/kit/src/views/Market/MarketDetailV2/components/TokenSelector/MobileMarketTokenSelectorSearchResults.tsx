import { memo, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';
import { FlatList } from 'react-native';

import {
  Button,
  Empty,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import { isDetailSearchChainToken } from '@onekeyhq/kit/src/views/Market/utils/marketSearchList';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import {
  TOKEN_SELECTOR_SEARCH_SECTION_PREVIEW_ROWS,
  convertSearchTokenToMarketToken,
} from './constants';
import { MarketTokenSelectorSearchTabs } from './MarketTokenSelectorSearchTabs';
import {
  MobileSelectorSearchSkeleton,
  MobileSelectorSearchTokenRow,
  MobileSelectorStockRow,
  MobileSelectorStockTable,
} from './MobileMarketSelectorBrowseLists';
import { StockLoadMoreFooter } from './selectorTable';
import {
  MARKET_SEARCH_TABS,
  useMarketTokenSelectorSearchState,
  useStockLoadMoreOnScrollEnd,
} from './useMarketTokenSelectorSearchState';

const SEARCH_SECTION_PREVIEW_LIMIT = TOKEN_SELECTOR_SEARCH_SECTION_PREVIEW_ROWS;
const LIST_STYLE = { flex: 1 } as const;

type IMarketSearchToken = IMarketSearchV2Token & {
  networkLogoURI: string;
  perpsCoin?: string;
};

// The raw search item is what navigation needs; the converted token is what
// the row renders.
type ISearchTokenEntry = {
  key: string;
  raw: IMarketSearchToken;
  token: IMarketToken;
};

function SectionTitle({ title }: { title: string }) {
  return (
    <SizableText px="$5" py="$2" size="$headingSm" color="$textSubdued">
      {title}
    </SizableText>
  );
}

/** Full-width, like the wallet home token list's Show more. */
function ShowMoreButton({
  testID,
  onPress,
}: {
  testID: string;
  onPress: () => void;
}) {
  const intl = useIntl();
  return (
    <XStack pt="$3" px="$5" justifyContent="center" alignItems="center">
      <Button
        testID={testID}
        size="medium"
        variant="secondary"
        flex={1}
        onPress={onPress}
      >
        {intl.formatMessage({ id: ETranslations.global_show_more })}
      </Button>
    </XStack>
  );
}

function SearchTokenRow({
  entry,
  onPress,
}: {
  entry: ISearchTokenEntry;
  onPress: (item: IMarketSearchToken) => void;
}) {
  const handlePress = useCallback(
    () => onPress(entry.raw),
    [entry.raw, onPress],
  );
  return (
    <MobileSelectorSearchTokenRow item={entry.token} onPress={handlePress} />
  );
}

function MobileMarketTokenSelectorSearchResults({
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
  onMarketPress: (item: IMarketSearchToken) => void;
}) {
  const intl = useIntl();
  const tokenEntries = useMemo<ISearchTokenEntry[]>(
    () =>
      marketItems
        .filter((item) => isDetailSearchChainToken(item))
        .map((item) => ({
          key: `${item.network}:${item.address}`,
          raw: item,
          token: convertSearchTokenToMarketToken(item),
        })),
    [marketItems],
  );
  const hasTokenResults = tokenEntries.length > 0;
  const { activeTab, setActiveTab, stockResult, hasStockResults } =
    useMarketTokenSelectorSearchState(query, hasTokenResults);
  // Results show only once both searches have answered.
  const isSearching = Boolean(isMarketLoading) || stockResult.isLoading;

  const showStockSection = hasStockResults || stockResult.isError;
  // Only previews when both sections have rows; a lone section lists all.
  const isPreview = hasStockResults && hasTokenResults;
  // Stocks alone list every page, loading the next one as All scrolls.
  const isLoneStockSection = hasStockResults && !hasTokenResults;
  const handleAllScroll = useStockLoadMoreOnScrollEnd(
    stockResult,
    isLoneStockSection,
  );
  const stockRows = isPreview
    ? stockResult.items.slice(0, SEARCH_SECTION_PREVIEW_LIMIT)
    : stockResult.items;
  const tokenRows = isPreview
    ? tokenEntries.slice(0, SEARCH_SECTION_PREVIEW_LIMIT)
    : tokenEntries;

  const renderTokenItem = useCallback(
    ({ item }: { item: ISearchTokenEntry }) => (
      <SearchTokenRow entry={item} onPress={onMarketPress} />
    ),
    [onMarketPress],
  );

  let body: ReactNode;
  if (isSearching) {
    body = <MobileSelectorSearchSkeleton />;
  } else if (!showStockSection && !hasTokenResults) {
    body = (
      <YStack flex={1} alignItems="center" justifyContent="center">
        <Empty
          illustration="QuestionMark"
          title={intl.formatMessage({ id: ETranslations.global_no_results })}
        />
      </YStack>
    );
  } else if (activeTab === MARKET_SEARCH_TABS.stocks) {
    body = (
      <YStack flex={1} pt="$2.5">
        <MobileSelectorStockTable
          result={stockResult}
          onItemPress={onStockPress}
        />
      </YStack>
    );
  } else if (activeTab === MARKET_SEARCH_TABS.tokens) {
    body = (
      <FlatList
        data={tokenEntries}
        keyExtractor={(item) => item.key}
        renderItem={renderTokenItem}
        initialNumToRender={10}
        maxToRenderPerBatch={20}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 10 }}
        style={LIST_STYLE}
      />
    );
  } else {
    body = (
      <ScrollView
        flex={1}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 20 }}
        onScroll={handleAllScroll}
        scrollEventThrottle={64}
      >
        {showStockSection ? (
          <YStack pt="$2.5">
            <SectionTitle
              title={intl.formatMessage({
                id: ETranslations.perps_token_selector_stocks,
              })}
            />
            {stockResult.isError && stockRows.length === 0 ? (
              <YStack py="$4" alignItems="center" gap="$2">
                <SizableText color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.global_connet_error_try_again,
                  })}
                </SizableText>
                <Button
                  testID="mobile-market-token-selector-stock-search-retry"
                  size="small"
                  variant="tertiary"
                  onPress={() => void stockResult.refresh()}
                >
                  {intl.formatMessage({ id: ETranslations.global_retry })}
                </Button>
              </YStack>
            ) : null}
            {stockRows.map((item) => (
              <MobileSelectorStockRow
                key={item.stockId}
                item={item}
                onPress={onStockPress}
              />
            ))}
            {isPreview &&
            (stockResult.items.length > SEARCH_SECTION_PREVIEW_LIMIT ||
              stockResult.canLoadMore) ? (
              <ShowMoreButton
                testID="mobile-market-token-selector-stock-search-show-more"
                onPress={() => setActiveTab(MARKET_SEARCH_TABS.stocks)}
              />
            ) : null}
            {isLoneStockSection ? (
              <StockLoadMoreFooter
                isLoadingMore={stockResult.isLoadingMore}
                isLoadMoreError={stockResult.isLoadMoreError}
                onRetry={() => void stockResult.loadMore()}
                testID="mobile-market-token-selector-stock-search-load-more-retry"
              />
            ) : null}
          </YStack>
        ) : null}
        {hasTokenResults ? (
          <YStack pt="$2.5">
            <SectionTitle
              title={intl.formatMessage({
                id: ETranslations.global_universal_search_tabs_tokens,
              })}
            />
            {tokenRows.map((entry) => (
              <SearchTokenRow
                key={entry.key}
                entry={entry}
                onPress={onMarketPress}
              />
            ))}
            {isPreview && tokenEntries.length > SEARCH_SECTION_PREVIEW_LIMIT ? (
              <ShowMoreButton
                testID="mobile-market-token-selector-market-search-show-more"
                onPress={() => setActiveTab(MARKET_SEARCH_TABS.tokens)}
              />
            ) : null}
          </YStack>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <YStack flex={1}>
      <MarketTokenSelectorSearchTabs
        value={activeTab}
        onChange={setActiveTab}
        // Only All shows while searching; type tabs join with the results.
        hasStockResults={!isSearching && hasStockResults}
        hasTokenResults={!isSearching && hasTokenResults}
      />
      <YStack flex={1}>{body}</YStack>
    </YStack>
  );
}

const MemoMobileMarketTokenSelectorSearchResults = memo(
  MobileMarketTokenSelectorSearchResults,
);

export { MemoMobileMarketTokenSelectorSearchResults as MobileMarketTokenSelectorSearchResults };
