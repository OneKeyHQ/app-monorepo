import { memo, useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Empty,
  Icon,
  ListView,
  ScrollView,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { MarketStockStar } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/MarketStockStar';
import { parseMarketStockNumber } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/utils';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import {
  applyMarketSectionPreview,
  isDetailSearchChainToken,
} from '@onekeyhq/kit/src/views/Market/utils/marketSearchList';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';
import type {
  IMarketStockPublicItem,
  IMarketTokenDetailPreview,
} from '@onekeyhq/shared/types/marketV2';

import { buildMarketSearchTokenDetailPreview } from '../../utils/marketDetailPreview';

import {
  TOKEN_SELECTOR_COLUMN_PADDING,
  TOKEN_SELECTOR_CONTENT_GUTTER,
  TOKEN_SELECTOR_HEADER_HEIGHT,
  TOKEN_SELECTOR_LIST_PADDING_BOTTOM,
  TOKEN_SELECTOR_METRIC_COLUMNS,
  TOKEN_SELECTOR_METRIC_FLEX,
  TOKEN_SELECTOR_NAME_GAP,
  TOKEN_SELECTOR_ROW_HEIGHT,
  TOKEN_SELECTOR_SEARCH_NAME_COLUMN_WIDTH,
  TOKEN_SELECTOR_SEARCH_SECTION_PREVIEW_ROWS,
  TOKEN_SELECTOR_SHOW_MORE_HEIGHT,
  TOKEN_SELECTOR_STAR_COLUMN_WIDTH,
  TOKEN_SELECTOR_TABLE_PADDING,
  convertSearchTokenToMarketToken,
} from './constants';
import { MarketStockSelectorTable } from './MarketStockSelectorList';
import { MarketTokenSelectorRow } from './MarketTokenSelectorRow';
import { MarketTokenSelectorSearchTabs } from './MarketTokenSelectorSearchTabs';
import {
  type ISelectorHeaderCell,
  type ISelectorSortOrder,
  SelectorAmountCell,
  SelectorPriceChangeCell,
  SelectorTableHeader,
  StockLoadMoreFooter,
  getNextSelectorSortOrder,
  sortSelectorRows,
} from './selectorTable';
import {
  MARKET_SEARCH_TABS,
  useMarketTokenSelectorSearchState,
  useStockLoadMoreOnScrollEnd,
} from './useMarketTokenSelectorSearchState';

import type {
  IMarketTokenSelectorColumns,
  IMarketTokenSelectorMetricColumn,
} from './constants';

// With results in more than one section, All previews this many per section.
const SEARCH_SECTION_PREVIEW_LIMIT = TOKEN_SELECTOR_SEARCH_SECTION_PREVIEW_ROWS;
// Section keys for the shared All preview rule.
const STOCK_SECTION_INDEX = 0;
const TOKEN_SECTION_INDEX = 1;
// The space between a search All tab's sections, above a stock or token one.
export const MARKET_SEARCH_SECTION_GAP = 10;
const SECTION_TITLE_POSITION = platformEnv.isNative ? 'relative' : 'sticky';

// `VirtualizedList` (web/desktop/extension) pins `ListHeaderComponent` at
// sticky index 0; FlashList (native) would pin the first row instead.
const STICKY_HEADER_INDICES = platformEnv.isNative ? undefined : [0];

const SEARCH_TOKEN_COLUMNS: IMarketTokenSelectorColumns = {
  metrics: TOKEN_SELECTOR_METRIC_COLUMNS.search,
  flex: TOKEN_SELECTOR_METRIC_FLEX.search,
};
// The price-over-change column's share, shared by the stock section so its
// columns stay under the token section's.
const PRICE_CHANGE_FLEX = TOKEN_SELECTOR_METRIC_FLEX.search.priceChange;

type IMarketSearchToken = IMarketSearchV2Token & {
  networkLogoURI: string;
};
export type IMarketSearchResultToken = IMarketToken & {
  tokenDetailPreview?: IMarketTokenDetailPreview;
};

type ISearchTokenSortField = 'liquidity' | 'marketCap' | 'turnover';
type ISearchTokenSort = {
  field: ISearchTokenSortField;
  order: ISelectorSortOrder;
};

function useSearchTokenHeaderCells(
  sort?: ISearchTokenSort,
  onSortPress?: (field: ISearchTokenSortField) => void,
): ISelectorHeaderCell[] {
  const intl = useIntl();
  return useMemo(() => {
    const sortProps = (field: ISearchTokenSortField) =>
      onSortPress
        ? {
            sort: {
              order: sort?.field === field ? sort.order : undefined,
              onPress: () => onSortPress(field),
            },
          }
        : {};
    return [
      {
        key: 'liquidity',
        label: intl.formatMessage({ id: ETranslations.global_liquidity }),
        ...sortProps('liquidity'),
      },
      {
        key: 'priceChange',
        flex: PRICE_CHANGE_FLEX,
        label: `${intl.formatMessage({
          id: ETranslations.global_price,
        })} / ${intl.formatMessage(
          { id: ETranslations.market_change_in_range },
          { range: '24h' },
        )}`,
      },
      {
        key: 'marketCap',
        label: intl.formatMessage({ id: ETranslations.global_market_cap }),
        ...sortProps('marketCap'),
      },
      {
        key: 'turnover',
        label: intl.formatMessage(
          { id: ETranslations.market_volume_in_range },
          { range: '24h' },
        ),
        ...sortProps('turnover'),
      },
    ];
  }, [intl, onSortPress, sort]);
}

/**
 * The All tab's stock header. Its first metric slot stays empty so price,
 * market cap and volume line up with the token section's columns below.
 */
function useSearchStockHeaderCells(): ISelectorHeaderCell[] {
  const intl = useIntl();
  return useMemo(
    () => [
      { key: 'spacer' },
      {
        key: 'priceChange',
        flex: PRICE_CHANGE_FLEX,
        label: `${intl.formatMessage({
          id: ETranslations.global_price,
        })} / ${intl.formatMessage({
          id: ETranslations.market_stock_change__title,
        })}`,
        tooltip: intl.formatMessage({
          id: ETranslations.market_stock_price_underlying_tooltip,
        }),
      },
      {
        key: 'marketCap',
        label: intl.formatMessage({ id: ETranslations.global_market_cap }),
      },
      {
        key: 'volume',
        label: intl.formatMessage({
          id: ETranslations.market_stock_volume__title,
        }),
      },
    ],
    [intl],
  );
}

/**
 * A search All section title. It sticks while its own section is in view; the
 * desktop search only renders on web, where the shared ScrollView's
 * `stickyHeaderIndices` cannot reach its children (they sit inside a context
 * provider), so it sticks through CSS.
 */
export function MarketSearchSectionTitle({
  title,
  bg = '$bg',
}: {
  title: string;
  // Matches the surface it scrolls over: the selector popover or the
  // universal search modal.
  bg?: '$bg' | '$bgApp';
}) {
  return (
    <SizableText
      position={SECTION_TITLE_POSITION}
      top={0}
      // Above row content that layers itself, like the account avatar
      // badge (`zIndex="$1"`).
      zIndex="$2"
      // Opaque so the rows scroll under it while it sticks.
      bg={bg}
      px={TOKEN_SELECTOR_CONTENT_GUTTER}
      py="$2"
      size="$headingSm"
      color="$textSubdued"
      cursor="default"
      userSelect="none"
    >
      {title}
    </SizableText>
  );
}

/**
 * A full-width row, like Universal Search's Show more, inset to the table so
 * its label starts on the name column's edge.
 */
function ShowMoreButton({
  testID,
  onPress,
}: {
  testID: string;
  onPress: () => void;
}) {
  const intl = useIntl();
  return (
    <XStack px={TOKEN_SELECTOR_TABLE_PADDING} pt="$1">
      <XStack
        testID={testID}
        onPress={onPress}
        flex={1}
        height={TOKEN_SELECTOR_SHOW_MORE_HEIGHT}
        px={TOKEN_SELECTOR_COLUMN_PADDING}
        alignItems="center"
        gap="$2"
        borderRadius="$3"
        borderCurve="continuous"
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        cursor="default"
        userSelect="none"
      >
        <SizableText size="$bodyMdMedium" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_show_more })}
        </SizableText>
        <Icon name="ChevronRightSmallOutline" size="$4" color="$iconSubdued" />
      </XStack>
    </XStack>
  );
}

const SKELETON_ROW_COUNT = 6;

// A skeleton bar centred in the line box of the text it stands for, so the
// placeholder sits where that text will render.
function SkeletonLine({
  lineHeight,
  h,
  w,
}: {
  lineHeight: number;
  h: '$2.5' | '$3';
  w: '$10' | '$14' | '$16' | '$32';
}) {
  return (
    <Stack height={lineHeight} justifyContent="center">
      <Skeleton h={h} w={w} />
    </Stack>
  );
}

/**
 * One table line in the real tables' frame — star slot, name column, then the
 * search metric columns with their weights — so header and rows line up with
 * the results that replace them.
 */
function SkeletonTableLine({
  height,
  star,
  name,
  renderMetric,
}: {
  height: number;
  star: ReactNode;
  name: ReactNode;
  renderMetric: (metric: IMarketTokenSelectorMetricColumn) => ReactNode;
}) {
  return (
    <XStack height={height} alignItems="center">
      <XStack
        width={TOKEN_SELECTOR_SEARCH_NAME_COLUMN_WIDTH}
        flexShrink={0}
        px={TOKEN_SELECTOR_COLUMN_PADDING}
        gap={TOKEN_SELECTOR_NAME_GAP}
        alignItems="center"
      >
        <Stack
          width={TOKEN_SELECTOR_STAR_COLUMN_WIDTH}
          alignItems="center"
          justifyContent="center"
        >
          {star}
        </Stack>
        {name}
      </XStack>
      {TOKEN_SELECTOR_METRIC_COLUMNS.search.map((metric) => (
        <XStack
          key={metric}
          flex={TOKEN_SELECTOR_METRIC_FLEX.search[metric] ?? 1}
          flexBasis={0}
          minWidth={0}
          px={TOKEN_SELECTOR_COLUMN_PADDING}
          justifyContent="flex-end"
        >
          {renderMetric(metric)}
        </XStack>
      ))}
    </XStack>
  );
}

function SkeletonHeader() {
  return (
    <SkeletonTableLine
      height={TOKEN_SELECTOR_HEADER_HEIGHT}
      star={<Skeleton w="$2.5" h="$2.5" radius="round" />}
      name={<SkeletonLine lineHeight={16} h="$2.5" w="$10" />}
      renderMetric={() => <SkeletonLine lineHeight={16} h="$2.5" w="$14" />}
    />
  );
}

function SkeletonRow() {
  return (
    <SkeletonTableLine
      height={TOKEN_SELECTOR_ROW_HEIGHT}
      // The 16px star glyph inside its 24px slot.
      star={<Skeleton w="$4" h="$4" radius="round" />}
      name={
        <XStack flex={1} alignItems="center" gap="$3">
          <Skeleton w="$8" h="$8" radius="round" />
          <YStack gap="$1">
            <SkeletonLine lineHeight={20} h="$3" w="$16" />
            <SkeletonLine lineHeight={16} h="$2.5" w="$32" />
          </YStack>
        </XStack>
      }
      renderMetric={() => <SkeletonLine lineHeight={20} h="$3" w="$16" />}
    />
  );
}

/**
 * Shown for the whole result area until both the stock and the token search
 * have answered, like universal search: the sections then appear at once
 * instead of one pushing the other down when it lands later. It mirrors a
 * section — title, column header, rows — in the tables' exact frame.
 */
export function SearchResultsSkeleton() {
  return (
    <YStack pt="$2.5">
      <XStack px={TOKEN_SELECTOR_CONTENT_GUTTER} py="$2">
        <SkeletonLine lineHeight={20} h="$3" w="$16" />
      </XStack>
      <YStack px={TOKEN_SELECTOR_TABLE_PADDING}>
        <SkeletonHeader />
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
          <SkeletonRow key={index} />
        ))}
      </YStack>
    </YStack>
  );
}

const StockSearchRow = memo(
  ({
    item,
    onPress,
  }: {
    item: IMarketStockPublicItem;
    onPress: (item: IMarketStockPublicItem) => void;
  }) => {
    const handlePress = useCallback(() => onPress(item), [item, onPress]);
    const marketTags = item.tags?.filter(Boolean) ?? [];
    return (
      <XStack
        testID={`market-stock-selector-row-${item.stockId}`}
        height={TOKEN_SELECTOR_ROW_HEIGHT}
        alignItems="center"
        borderRadius="$3"
        borderCurve="continuous"
        cursor="default"
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        onPress={handlePress}
      >
        <XStack
          width={TOKEN_SELECTOR_SEARCH_NAME_COLUMN_WIDTH}
          flexShrink={0}
          px={TOKEN_SELECTOR_COLUMN_PADDING}
          gap={TOKEN_SELECTOR_NAME_GAP}
          alignItems="center"
          minWidth={0}
        >
          <Stack
            width={TOKEN_SELECTOR_STAR_COLUMN_WIDTH}
            alignItems="center"
            justifyContent="center"
          >
            <MarketStockStar stock={item} from={EWatchlistFrom.Search} />
          </Stack>
          <XStack flex={1} minWidth={0} alignItems="center" gap="$3">
            <Token
              size="md"
              borderRadius="$full"
              tokenImageUri={item.logoUrl}
              fallbackIcon="CryptoCoinOutline"
            />
            <YStack flex={1} minWidth={0} gap="$1" justifyContent="center">
              <SizableText size="$headingSm" numberOfLines={1}>
                {item.symbol}
              </SizableText>
              <XStack height={16} alignItems="center" gap="$1.5" minWidth={0}>
                {marketTags.map((tag) => (
                  <Badge
                    key={tag}
                    badgeType="default"
                    badgeSize="sm"
                    px="$1"
                    py="$0.5"
                    flexShrink={0}
                  >
                    <Badge.Text size="$bodyXs" lineHeight={12}>
                      {tag}
                    </Badge.Text>
                  </Badge>
                ))}
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  numberOfLines={1}
                  flexShrink={1}
                >
                  {item.name}
                </SizableText>
              </XStack>
            </YStack>
          </XStack>
        </XStack>
        {/* Empty slot under the token section's Liquidity column. It keeps
           the cells' padding: flex shares grow from the padded base, so a
           bare slot would come out narrower and pull the next columns left. */}
        <Stack
          flex={1}
          flexBasis={0}
          minWidth={0}
          px={TOKEN_SELECTOR_COLUMN_PADDING}
        />
        <XStack
          flex={PRICE_CHANGE_FLEX}
          flexBasis={0}
          minWidth={0}
          px={TOKEN_SELECTOR_COLUMN_PADDING}
          justifyContent="flex-end"
        >
          <SelectorPriceChangeCell
            price={parseMarketStockNumber(item.price)}
            change={parseMarketStockNumber(item.priceChange24hPercent)}
          />
        </XStack>
        <XStack
          flex={1}
          flexBasis={0}
          minWidth={0}
          px={TOKEN_SELECTOR_COLUMN_PADDING}
          justifyContent="flex-end"
        >
          <SelectorAmountCell value={parseMarketStockNumber(item.marketCap)} />
        </XStack>
        <XStack
          flex={1}
          flexBasis={0}
          minWidth={0}
          px={TOKEN_SELECTOR_COLUMN_PADDING}
          justifyContent="flex-end"
        >
          <SelectorAmountCell value={parseMarketStockNumber(item.volume24h)} />
        </XStack>
      </XStack>
    );
  },
);
StockSearchRow.displayName = 'StockSearchRow';

/** The stock section's body when its first page failed to load. */
export function StockSearchError({
  testID,
  onRetry,
}: {
  testID: string;
  onRetry: () => void;
}) {
  const intl = useIntl();
  return (
    <YStack py="$4" alignItems="center" gap="$2">
      <SizableText color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.global_connet_error_try_again,
        })}
      </SizableText>
      <Button testID={testID} size="small" variant="tertiary" onPress={onRetry}>
        {intl.formatMessage({ id: ETranslations.global_retry })}
      </Button>
    </YStack>
  );
}

/** The stock section of a search All tab, shared with universal search. */
export function MarketSearchStockSection({
  items,
  isError,
  showMore,
  onShowMore,
  onRetry,
  onPress,
  loadMore,
  titleBg,
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
  titleBg?: '$bg' | '$bgApp';
}) {
  const intl = useIntl();
  const headerCells = useSearchStockHeaderCells();
  return (
    <YStack>
      <MarketSearchSectionTitle
        title={intl.formatMessage({
          id: ETranslations.perps_token_selector_stocks,
        })}
        bg={titleBg}
      />
      {isError && items.length === 0 ? (
        <StockSearchError
          testID="market-token-selector-stock-search-retry"
          onRetry={onRetry}
        />
      ) : null}
      {items.length > 0 ? (
        <YStack px={TOKEN_SELECTOR_TABLE_PADDING}>
          <SelectorTableHeader
            nameTitle={intl.formatMessage({
              id: ETranslations.market_stock_company,
            })}
            cells={headerCells}
            nameColumnWidth={TOKEN_SELECTOR_SEARCH_NAME_COLUMN_WIDTH}
          />
          {items.map((item) => (
            <StockSearchRow key={item.stockId} item={item} onPress={onPress} />
          ))}
        </YStack>
      ) : null}
      {loadMore ? (
        <StockLoadMoreFooter
          isLoadingMore={loadMore.isLoadingMore}
          isLoadMoreError={loadMore.isLoadMoreError}
          onRetry={loadMore.onRetry}
          testID="market-token-selector-stock-search-load-more-retry"
        />
      ) : null}
      {showMore ? (
        <ShowMoreButton
          testID="market-token-selector-stock-search-show-more"
          onPress={onShowMore}
        />
      ) : null}
    </YStack>
  );
}

/** The token section of a search All tab, shared with universal search. */
export function MarketSearchTokenSection({
  items,
  showMore,
  onShowMore,
  onPress,
  titleBg,
}: {
  items: IMarketSearchResultToken[];
  showMore: boolean;
  onShowMore: () => void;
  onPress: (item: IMarketSearchResultToken) => void;
  titleBg?: '$bg' | '$bgApp';
}) {
  const intl = useIntl();
  const headerCells = useSearchTokenHeaderCells();
  return (
    <YStack>
      <MarketSearchSectionTitle
        title={intl.formatMessage({
          id: ETranslations.global_universal_search_tabs_tokens,
        })}
        bg={titleBg}
      />
      {items.length > 0 ? (
        <YStack px={TOKEN_SELECTOR_TABLE_PADDING}>
          <SelectorTableHeader
            nameTitle={intl.formatMessage({ id: ETranslations.global_name })}
            cells={headerCells}
            nameColumnWidth={TOKEN_SELECTOR_SEARCH_NAME_COLUMN_WIDTH}
          />
          {items.map((item) => (
            <MarketTokenSelectorRow
              key={item.id}
              item={item}
              onPress={onPress as (item: IMarketToken) => void}
              subtitleVariant="nameAddress"
              columns={SEARCH_TOKEN_COLUMNS}
              nameColumnWidth={TOKEN_SELECTOR_SEARCH_NAME_COLUMN_WIDTH}
            />
          ))}
        </YStack>
      ) : null}
      {showMore ? (
        <ShowMoreButton
          testID="market-token-selector-market-search-show-more"
          onPress={onShowMore}
        />
      ) : null}
    </YStack>
  );
}

const SORT_VALUE_GETTERS: Record<
  ISearchTokenSortField,
  (item: IMarketSearchResultToken) => number | undefined
> = {
  liquidity: (item) => item.liquidity,
  marketCap: (item) => item.marketCap,
  turnover: (item) => item.turnover,
};

/**
 * The Tokens tab: every result in search relevance order, with Liquidity,
 * Market cap and 24h volume sortable over the loaded rows.
 */
export function TokenTabList({
  items,
  onPress,
}: {
  items: IMarketSearchResultToken[];
  onPress: (item: IMarketSearchResultToken) => void;
}) {
  const intl = useIntl();
  const [sort, setSort] = useState<ISearchTokenSort | undefined>(undefined);
  const handleSortPress = useCallback((field: ISearchTokenSortField) => {
    setSort((prev) => {
      const order = getNextSelectorSortOrder(
        prev?.field === field ? prev.order : undefined,
      );
      return order ? { field, order } : undefined;
    });
  }, []);
  const headerCells = useSearchTokenHeaderCells(sort, handleSortPress);
  const rows = useMemo(
    () =>
      sort
        ? sortSelectorRows(items, SORT_VALUE_GETTERS[sort.field], sort.order)
        : items,
    [items, sort],
  );
  const listHeader = useMemo(
    () => (
      <SelectorTableHeader
        nameTitle={intl.formatMessage({ id: ETranslations.global_name })}
        cells={headerCells}
        nameColumnWidth={TOKEN_SELECTOR_SEARCH_NAME_COLUMN_WIDTH}
      />
    ),
    [headerCells, intl],
  );

  return (
    <ListView
      estimatedItemSize={TOKEN_SELECTOR_ROW_HEIGHT}
      data={rows}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={listHeader}
      stickyHeaderIndices={STICKY_HEADER_INDICES}
      renderItem={({ item }) => (
        <MarketTokenSelectorRow
          item={item}
          onPress={onPress as (item: IMarketToken) => void}
          subtitleVariant="nameAddress"
          columns={SEARCH_TOKEN_COLUMNS}
          nameColumnWidth={TOKEN_SELECTOR_SEARCH_NAME_COLUMN_WIDTH}
        />
      )}
      contentContainerStyle={{
        paddingHorizontal: TOKEN_SELECTOR_TABLE_PADDING,
        paddingBottom: TOKEN_SELECTOR_LIST_PADDING_BOTTOM,
      }}
    />
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
  const hasTokenResults = chainTokenItems.length > 0;
  const { activeTab, setActiveTab, stockResult, hasStockResults } =
    useMarketTokenSelectorSearchState(query, hasTokenResults);
  // Results show only once both searches have answered.
  const isSearching = Boolean(isMarketLoading) || stockResult.isLoading;

  const showStockSection = hasStockResults || stockResult.isError;
  const showTokenSection = hasTokenResults;
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
      { tabIndex: TOKEN_SECTION_INDEX, data: chainTokenItems },
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
    body = <SearchResultsSkeleton />;
  } else if (!showStockSection && !showTokenSection) {
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
        <MarketStockSelectorTable
          result={stockResult}
          onItemPress={onStockPress}
        />
      </YStack>
    );
  } else if (activeTab === MARKET_SEARCH_TABS.tokens) {
    body = (
      <YStack flex={1} pt="$2.5">
        <TokenTabList items={chainTokenItems} onPress={onMarketPress} />
      </YStack>
    );
  } else {
    // The 10px under the tab bar stays put, as above the Stocks and Tokens
    // tables; titles stick below it and only the space between sections
    // scrolls.
    body = (
      <YStack flex={1} pt="$2.5">
        <ScrollView
          flex={1}
          contentContainerStyle={{
            paddingBottom: TOKEN_SELECTOR_LIST_PADDING_BOTTOM,
          }}
          onScroll={handleAllScroll}
          scrollEventThrottle={64}
        >
          {showStockSection ? (
            <>
              <MarketSearchStockSection
                items={stockResult.items.slice(
                  0,
                  stockPreview.sliceData?.length,
                )}
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
            </>
          ) : null}
          {showTokenSection ? (
            <>
              {showStockSection ? (
                <Stack height={MARKET_SEARCH_SECTION_GAP} />
              ) : null}
              <MarketSearchTokenSection
                items={chainTokenItems.slice(0, tokenPreview.sliceData?.length)}
                showMore={Boolean(tokenPreview.showMore)}
                onShowMore={() => setActiveTab(MARKET_SEARCH_TABS.tokens)}
                onPress={onMarketPress}
              />
            </>
          ) : null}
        </ScrollView>
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

const MemoMarketTokenSelectorSearchResults = memo(
  MarketTokenSelectorSearchResults,
);

export { MemoMarketTokenSelectorSearchResults as MarketTokenSelectorSearchResults };
