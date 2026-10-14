import { memo, useCallback, useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { useIntl } from 'react-intl';
import { FlatList, ScrollView as NativeScrollView } from 'react-native';

import {
  Button,
  Empty,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import {
  applyMarketSectionPreview,
  isDetailSearchChainToken,
} from '@onekeyhq/kit/src/views/Market/utils/marketSearchList';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import {
  TOKEN_SELECTOR_SEARCH_SECTION_GAP,
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

import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

const SEARCH_SECTION_PREVIEW_LIMIT = TOKEN_SELECTOR_SEARCH_SECTION_PREVIEW_ROWS;
// Section keys for the shared All preview rule.
const STOCK_SECTION_INDEX = 0;
const TOKEN_SECTION_INDEX = 1;
const LIST_STYLE = { flex: 1 } as const;
const ALL_CONTENT_STYLE = { paddingBottom: 20 } as const;

type IMarketSearchToken = IMarketSearchV2Token & {
  networkLogoURI: string;
  perpsCoin?: string;
};

/**
 * A token search result: the raw item navigation needs, keyed, with the
 * converted token the row renders. Universal search passes its own result
 * items as `raw`.
 */
export type IMobileMarketSearchTokenEntry<T> = {
  key: string;
  raw: T;
  token: IMarketToken;
};

export function MobileMarketSearchSectionTitle({ title }: { title: string }) {
  return (
    <SizableText
      // Opaque so the rows scroll under it while it sticks.
      bg="$bgApp"
      px="$5"
      py="$2"
      size="$headingSm"
      color="$textSubdued"
    >
      {title}
    </SizableText>
  );
}

export type IMobileMarketSearchAllSection = {
  key: string;
  title: string;
  body: ReactNode;
};

/**
 * A mobile search All tab, shared with universal search: each section's title
 * sticks until the next one pushes it out. The shared ScrollView wraps its
 * children in a context provider, which hides them from
 * `stickyHeaderIndices`, so this uses React Native's own.
 */
export function MobileMarketSearchAllList({
  sections,
  onScroll,
}: {
  sections: IMobileMarketSearchAllSection[];
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const children: ReactNode[] = [];
  const stickyHeaderIndices: number[] = [];
  sections.forEach((section, index) => {
    if (index > 0) {
      children.push(
        <Stack
          key={`${section.key}-gap`}
          height={TOKEN_SELECTOR_SEARCH_SECTION_GAP}
        />,
      );
    }
    stickyHeaderIndices.push(children.length);
    children.push(
      <MobileMarketSearchSectionTitle
        key={`${section.key}-title`}
        title={section.title}
      />,
    );
    children.push(<YStack key={`${section.key}-body`}>{section.body}</YStack>);
  });
  return (
    <NativeScrollView
      style={LIST_STYLE}
      contentContainerStyle={ALL_CONTENT_STYLE}
      stickyHeaderIndices={stickyHeaderIndices}
      keyboardShouldPersistTaps="handled"
      onScroll={onScroll}
      scrollEventThrottle={64}
    >
      {children}
    </NativeScrollView>
  );
}

/** Full-width, like the wallet home token list's Show more. */
export function MobileMarketSearchShowMoreButton({
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

function SearchTokenRow<T>({
  entry,
  onPress,
}: {
  entry: IMobileMarketSearchTokenEntry<T>;
  onPress: (item: T) => void;
}) {
  const handlePress = useCallback(
    () => onPress(entry.raw),
    [entry.raw, onPress],
  );
  return (
    <MobileSelectorSearchTokenRow item={entry.token} onPress={handlePress} />
  );
}

/** The body of a mobile search All tab's stock section, shared with universal search. */
export function MobileMarketSearchStockRows({
  items,
  isError,
  showMore,
  onShowMore,
  onRetry,
  onPress,
  loadMore,
}: {
  items: IMarketStockPublicItem[];
  isError: boolean;
  showMore: boolean;
  onShowMore: () => void;
  onRetry: () => void;
  onPress: (item: IMarketStockPublicItem) => void;
  // Set when the section lists every stock and pages as All scrolls.
  loadMore?: {
    isLoadingMore: boolean;
    isLoadMoreError: boolean;
    onRetry: () => void;
  };
}) {
  const intl = useIntl();
  return (
    <YStack>
      {isError && items.length === 0 ? (
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
            onPress={onRetry}
          >
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        </YStack>
      ) : null}
      {items.map((item) => (
        <MobileSelectorStockRow
          key={item.stockId}
          item={item}
          onPress={onPress}
        />
      ))}
      {showMore ? (
        <MobileMarketSearchShowMoreButton
          testID="mobile-market-token-selector-stock-search-show-more"
          onPress={onShowMore}
        />
      ) : null}
      {loadMore ? (
        <StockLoadMoreFooter
          isLoadingMore={loadMore.isLoadingMore}
          isLoadMoreError={loadMore.isLoadMoreError}
          onRetry={loadMore.onRetry}
          testID="mobile-market-token-selector-stock-search-load-more-retry"
        />
      ) : null}
    </YStack>
  );
}

/** The body of a mobile search All tab's token section, shared with universal search. */
export function MobileMarketSearchTokenRows<T>({
  entries,
  showMore,
  onShowMore,
  onPress,
}: {
  entries: IMobileMarketSearchTokenEntry<T>[];
  showMore: boolean;
  onShowMore: () => void;
  onPress: (item: T) => void;
}) {
  return (
    <YStack>
      {entries.map((entry) => (
        <SearchTokenRow key={entry.key} entry={entry} onPress={onPress} />
      ))}
      {showMore ? (
        <MobileMarketSearchShowMoreButton
          testID="mobile-market-token-selector-market-search-show-more"
          onPress={onShowMore}
        />
      ) : null}
    </YStack>
  );
}

/** The mobile search Tokens tab, shared with universal search. */
export function MobileMarketSearchTokenList<T>({
  entries,
  onPress,
  listHeader,
}: {
  entries: IMobileMarketSearchTokenEntry<T>[];
  onPress: (item: T) => void;
  // Scrolls with the rows, e.g. universal search's section title.
  listHeader?: ReactElement;
}) {
  const renderItem = useCallback(
    ({ item }: { item: IMobileMarketSearchTokenEntry<T> }) => (
      <SearchTokenRow entry={item} onPress={onPress} />
    ),
    [onPress],
  );
  return (
    <FlatList
      data={entries}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      initialNumToRender={10}
      maxToRenderPerBatch={20}
      windowSize={7}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={listHeader}
      style={LIST_STYLE}
    />
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
  const tokenEntries = useMemo<
    IMobileMarketSearchTokenEntry<IMarketSearchToken>[]
  >(
    () =>
      marketItems
        .filter((item) => isDetailSearchChainToken(item))
        .map((item) => {
          const token = convertSearchTokenToMarketToken(item);
          return { key: token.id, raw: item, token };
        }),
    [marketItems],
  );
  const hasTokenResults = tokenEntries.length > 0;
  const { activeTab, setActiveTab, stockResult, hasStockResults } =
    useMarketTokenSelectorSearchState(query, hasTokenResults);
  // Results show only once both searches have answered.
  const isSearching = Boolean(isMarketLoading) || stockResult.isLoading;

  const showStockSection = hasStockResults || stockResult.isError;
  // Only the preview lengths and Show more are read back, so the two
  // sections' row types need not match.
  const [stockPreview, tokenPreview] = applyMarketSectionPreview<{
    tabIndex: number;
    data: unknown[];
    sliceData?: unknown[];
    showMore?: boolean;
  }>(
    [
      { tabIndex: STOCK_SECTION_INDEX, data: stockResult.items },
      { tabIndex: TOKEN_SECTION_INDEX, data: tokenEntries },
    ],
    {
      stockTabIndex: STOCK_SECTION_INDEX,
      tokenTabIndex: TOKEN_SECTION_INDEX,
      previewLimit: SEARCH_SECTION_PREVIEW_LIMIT,
      stockCanLoadMore: stockResult.canLoadMore,
    },
  );
  // Stocks alone list every page, loading the next one as All scrolls.
  const isLoneStockSection = hasStockResults && !hasTokenResults;
  const handleAllScroll = useStockLoadMoreOnScrollEnd(
    stockResult,
    isLoneStockSection,
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
      <YStack flex={1} pt="$2.5">
        <MobileMarketSearchTokenList
          entries={tokenEntries}
          onPress={onMarketPress}
        />
      </YStack>
    );
  } else {
    // The 10px under the tab bar stays put, as above the Stocks and Tokens
    // lists; only the space between sections scrolls.
    const allSections: IMobileMarketSearchAllSection[] = [];
    if (showStockSection) {
      allSections.push({
        key: 'stocks',
        title: intl.formatMessage({
          id: ETranslations.perps_token_selector_stocks,
        }),
        body: (
          <MobileMarketSearchStockRows
            items={stockResult.items.slice(0, stockPreview.sliceData?.length)}
            isError={stockResult.isError}
            showMore={Boolean(stockPreview.showMore)}
            onShowMore={() => setActiveTab(MARKET_SEARCH_TABS.stocks)}
            onRetry={() => void stockResult.refresh()}
            onPress={onStockPress}
            loadMore={
              isLoneStockSection
                ? {
                    isLoadingMore: stockResult.isLoadingMore,
                    isLoadMoreError: stockResult.isLoadMoreError,
                    onRetry: () => void stockResult.loadMore(),
                  }
                : undefined
            }
          />
        ),
      });
    }
    if (hasTokenResults) {
      allSections.push({
        key: 'tokens',
        title: intl.formatMessage({
          id: ETranslations.global_universal_search_tabs_tokens,
        }),
        body: (
          <MobileMarketSearchTokenRows
            entries={tokenEntries.slice(0, tokenPreview.sliceData?.length)}
            showMore={Boolean(tokenPreview.showMore)}
            onShowMore={() => setActiveTab(MARKET_SEARCH_TABS.tokens)}
            onPress={onMarketPress}
          />
        ),
      });
    }
    body = (
      <YStack flex={1} pt="$2.5">
        <MobileMarketSearchAllList
          sections={allSections}
          onScroll={handleAllScroll}
        />
      </YStack>
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
