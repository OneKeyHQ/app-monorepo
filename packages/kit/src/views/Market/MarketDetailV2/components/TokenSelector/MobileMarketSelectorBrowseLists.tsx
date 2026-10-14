import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { useIntl } from 'react-intl';
import { FlatList } from 'react-native';

import {
  Badge,
  Button,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useNetworkLogoUri } from '@onekeyhq/kit/src/hooks/useNetworkLogoUri';
import {
  useMarketWatchListV2Atom,
  useWatchListV2Actions,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { MarketStockStar } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/MarketStockStar';
import { parseMarketStockNumber } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/utils';
import { applyMarketTokenListLiveOverrides } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketHomeTokenListWebSocket';
import { useMarketTokenList } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenList';
import { useMarketWatchlistTokenList } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketWatchlistTokenList';
import type { IMarketTokenListLiveOverride } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenListBase';
import { getMarketWatchlistRowKind } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/utils/marketWatchlistRowKind';
import type { IMarketTimeRangeValue } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/types';
import { isTrendingStyleSpotCategory } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/utils';
import { MarketTestIDs } from '@onekeyhq/kit/src/views/Market/testIDs';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { CommunityRecognizedBadge } from '../../../components/CommunityRecognizedBadge';
import { MarketListingStar } from '../../../components/MarketListingStar';
import { prewarmMarketTokenImages } from '../../utils/marketDetailImagePreload';

import {
  ALL_NETWORK_ID,
  TOKEN_SELECTOR_NAME_GAP,
  TOKEN_SELECTOR_POLLING_INTERVAL,
  TOKEN_SELECTOR_STAR_COLUMN_WIDTH,
} from './constants';
import { SelectorTokenStar } from './selectorStar';
import { useMarketStockSelectorList } from './useMarketStockSelectorList';

import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';

// Figma `Market / SearchModalList / Item` (26934:146096): a 64px row with 20px
// side padding, a 32px logo, the symbol over a 12px subtitle, and the price
// over its 24h change on the right.
const ROW_HEIGHT = 64;
// The 16px star glyph sits centred in its 24px slot; pulling the slot left by
// that 4px inset lines the glyph up with the 20px gutter the tabs, section
// titles and search field share, and hands the space to the name.
const STAR_GLYPH_SIZE = 16;
const STAR_SLOT_GUTTER_OFFSET =
  -(TOKEN_SELECTOR_STAR_COLUMN_WIDTH - STAR_GLYPH_SIZE) / 2;
const SUBTITLE_LINE_HEIGHT = 16;

function MissingValue({ size }: { size: '$bodyLgMedium' | '$bodySmMedium' }) {
  return (
    <SizableText size={size} color="$textSubdued">
      --
    </SizableText>
  );
}

function SubtitleLine({ children }: { children: ReactNode }) {
  return (
    <XStack
      height={SUBTITLE_LINE_HEIGHT}
      alignItems="center"
      gap="$1.5"
      minWidth={0}
    >
      {children}
    </XStack>
  );
}

function SubtitleText({ children }: { children: string }) {
  return (
    <SizableText
      size="$bodySm"
      color="$textSubdued"
      numberOfLines={1}
      flexShrink={1}
    >
      {children}
    </SizableText>
  );
}

/** Market badges (US / HK) before the company name. */
function StockSubtitle({ tags, name }: { tags?: string[]; name: string }) {
  const marketTags = tags?.filter(Boolean) ?? [];
  return (
    <SubtitleLine>
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
      {name ? <SubtitleText>{name}</SubtitleText> : null}
    </SubtitleLine>
  );
}

function formatCompactUsd(value: number): string | undefined {
  if (!value) {
    return undefined;
  }
  const formatted = formatDisplayNumber(
    NUMBER_FORMATTER.marketCap(String(value)),
  );
  return typeof formatted === 'string' ? `$${formatted}` : undefined;
}

function VolumeSubtitle({ volume }: { volume: number }) {
  const intl = useIntl();
  // Formatted to a string first so the whole "Vol $18.76M" phrase goes
  // through one message and each locale can order it.
  const value = formatCompactUsd(volume);
  if (!value) {
    return null;
  }
  return (
    <SubtitleLine>
      <SubtitleText>
        {intl.formatMessage({ id: ETranslations.market_vol_value }, { value })}
      </SubtitleText>
    </SubtitleLine>
  );
}

function NameSubtitle({ name }: { name: string }) {
  const displayName = name.trim();
  return displayName ? (
    <SubtitleLine>
      <SubtitleText>{displayName}</SubtitleText>
    </SubtitleLine>
  ) : null;
}

function BasicMobileMarketSelectorListItem({
  testID,
  tokenImageUri,
  tokenImageUris,
  networkLogoUri,
  networkId,
  symbol,
  communityRecognized,
  subtitle,
  price,
  priceChange,
  onPress,
  onPressIn,
  height = ROW_HEIGHT,
  nameGap = '$1',
  star,
}: {
  testID?: string;
  tokenImageUri: string;
  tokenImageUris?: string[];
  networkLogoUri?: string;
  networkId?: string;
  symbol: string;
  communityRecognized?: boolean;
  subtitle: ReactNode;
  price?: number;
  /** `undefined` when the feed has no change data. */
  priceChange?: number;
  onPress: () => void;
  onPressIn?: () => void;
  /** 74 for the three-line search token row, 64 otherwise. */
  height?: number;
  /** Space between the symbol and what is under it. */
  nameGap?: '$0.5' | '$1';
  /** The favorite star, drawn in the desktop selector's 24px star slot. */
  star?: ReactNode;
}) {
  // List rows may arrive without a chain logo (the all-networks list leaves it
  // empty), so it resolves from the row's own network instead.
  const resolvedNetworkLogoUri = useNetworkLogoUri({
    logoUri: networkLogoUri,
    networkId: networkId ?? '',
  });
  const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
    priceChange: priceChange ?? 0,
  });
  const hasPrice = price !== undefined && Number.isFinite(price);
  const hasPriceChange =
    priceChange !== undefined && Number.isFinite(priceChange);

  return (
    <XStack
      testID={testID}
      height={height}
      px="$5"
      py={height > ROW_HEIGHT ? '$2.5' : '$2'}
      gap="$3"
      alignItems="center"
      pressStyle={{ opacity: 0.8 }}
      onPress={onPress}
      onPressIn={onPressIn}
    >
      {/* Star and logo keep the desktop selector's spacing: a 24px star
         slot, then 6px to the logo. */}
      <XStack alignItems="center" gap={TOKEN_SELECTOR_NAME_GAP}>
        {star ? (
          <Stack
            width={TOKEN_SELECTOR_STAR_COLUMN_WIDTH}
            ml={STAR_SLOT_GUTTER_OFFSET}
            alignItems="center"
            justifyContent="center"
          >
            {star}
          </Stack>
        ) : null}
        <Token
          size="md"
          tokenImageUri={tokenImageUri}
          tokenImageUris={tokenImageUris}
          networkImageUri={networkId ? resolvedNetworkLogoUri : undefined}
          fallbackIcon="CryptoCoinOutline"
        />
      </XStack>
      <YStack flex={1} minWidth={0} gap={nameGap} justifyContent="center">
        <XStack alignItems="center" gap="$1" minWidth={0}>
          <SizableText size="$headingMd" numberOfLines={1} flexShrink={1}>
            {symbol}
          </SizableText>
          {communityRecognized ? <CommunityRecognizedBadge /> : null}
        </XStack>
        {subtitle}
      </YStack>
      <YStack alignItems="flex-end" justifyContent="center" gap="$1">
        {hasPrice ? (
          <NumberSizeableText
            size="$bodyLgMedium"
            numberOfLines={1}
            formatter="price"
            formatterOptions={{ currency: '$' }}
          >
            {price}
          </NumberSizeableText>
        ) : (
          <MissingValue size="$bodyLgMedium" />
        )}
        {hasPriceChange ? (
          <NumberSizeableText
            size="$bodySmMedium"
            color={changeColor}
            formatter="priceChangeCapped"
            formatterOptions={{ showPlusMinusSigns }}
          >
            {priceChange}
          </NumberSizeableText>
        ) : (
          <MissingValue size="$bodySmMedium" />
        )}
      </YStack>
    </XStack>
  );
}

export const MobileMarketSelectorListItem = memo(
  BasicMobileMarketSelectorListItem,
);

// No change data reads as `--`, like the desktop rows: the feed either omits
// the field (normalized to 0 on conversion) or sends '-'. A real '0' stays 0%.
function getTokenPriceChange(item: IMarketToken) {
  return item.priceChangeRaw === undefined || item.priceChangeRaw === '-'
    ? undefined
    : item.change24h;
}

/**
 * What a spot token's subtitle carries: Trending and Robinhood compare the
 * tokens by 24h volume, while Favorites names every row — stock and asset
 * listings already read by name, so spot tokens follow with their full name.
 */
type ITokenSubtitleKind = 'volume' | 'name';

/**
 * A token-shaped row. Stock and asset listings from the watchlist read their
 * subtitle like their own lists; spot tokens follow `tokenSubtitle`.
 */
const MobileSelectorTokenRow = memo(
  ({
    item,
    tokenSubtitle,
    onPress,
  }: {
    item: IMarketToken;
    tokenSubtitle: ITokenSubtitleKind;
    onPress: (item: IMarketToken) => void;
  }) => {
    const handlePress = useCallback(() => onPress(item), [item, onPress]);
    const handlePressIn = useCallback(
      () => prewarmMarketTokenImages(item),
      [item],
    );
    let subtitle: ReactNode;
    switch (getMarketWatchlistRowKind(item)) {
      case 'stock':
        subtitle = <StockSubtitle tags={item.stockTags} name={item.name} />;
        break;
      case 'asset':
        subtitle = <NameSubtitle name={item.name} />;
        break;
      default:
        subtitle =
          tokenSubtitle === 'name' ? (
            <NameSubtitle name={item.name} />
          ) : (
            <VolumeSubtitle volume={item.turnover} />
          );
    }
    return (
      <MobileMarketSelectorListItem
        testID={MarketTestIDs.tokenListItem(item.symbol)}
        tokenImageUri={item.tokenImageUri}
        tokenImageUris={item.tokenImageUris}
        networkLogoUri={item.networkLogoUri}
        networkId={item.networkId}
        symbol={item.symbol}
        communityRecognized={item.communityRecognized}
        subtitle={subtitle}
        price={item.price}
        priceChange={getTokenPriceChange(item)}
        star={<SelectorTokenStar item={item} />}
        onPress={handlePress}
        onPressIn={handlePressIn}
      />
    );
  },
);
MobileSelectorTokenRow.displayName = 'MobileSelectorTokenRow';

function CenteredSpinner() {
  return (
    <YStack flex={1} alignItems="center" justifyContent="center">
      <Spinner size="large" />
    </YStack>
  );
}

function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <YStack flex={1} alignItems="center" justifyContent="center" gap="$2">
      {children}
    </YStack>
  );
}

const LIST_STYLE = { flex: 1 } as const;

/** A first load that failed with nothing to show: say so and offer a retry. */
function LoadErrorMessage({
  testID,
  onRetry,
}: {
  testID: string;
  onRetry: () => void;
}) {
  const intl = useIntl();
  return (
    <CenteredMessage>
      <SizableText color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.global_connet_error_try_again,
        })}
      </SizableText>
      <Button size="small" variant="tertiary" testID={testID} onPress={onRetry}>
        {intl.formatMessage({ id: ETranslations.global_retry })}
      </Button>
    </CenteredMessage>
  );
}

function TokenRowsList({
  data,
  tokenSubtitle,
  onItemPress,
  onEndReached,
  footer,
}: {
  data: IMarketToken[];
  tokenSubtitle: ITokenSubtitleKind;
  onItemPress: (item: IMarketToken) => void;
  onEndReached?: () => void;
  footer?: ReactElement | null;
}) {
  const renderItem = useCallback(
    ({ item }: { item: IMarketToken }) => (
      <MobileSelectorTokenRow
        item={item}
        tokenSubtitle={tokenSubtitle}
        onPress={onItemPress}
      />
    ),
    [onItemPress, tokenSubtitle],
  );
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      getItemLayout={(_, index) => ({
        length: ROW_HEIGHT,
        offset: ROW_HEIGHT * index,
        index,
      })}
      initialNumToRender={12}
      maxToRenderPerBatch={20}
      windowSize={7}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      ListFooterComponent={footer}
      keyboardShouldPersistTaps="handled"
      style={LIST_STYLE}
    />
  );
}

function useLiveOverriddenTokens(
  data: IMarketToken[],
  liveTokenOverride?: IMarketTokenListLiveOverride,
) {
  return useMemo(
    () =>
      liveTokenOverride
        ? applyMarketTokenListLiveOverrides({
            tokens: data,
            liveTokenOverrides: [liveTokenOverride],
          })
        : data,
    [data, liveTokenOverride],
  );
}

/** Favorites: the watchlist in the user's own order, perps excluded. */
export function MobileSelectorWatchlistList({
  onItemPress,
  liveTokenOverride,
}: {
  onItemPress: (item: IMarketToken) => void;
  liveTokenOverride?: IMarketTokenListLiveOverride;
}) {
  const intl = useIntl();
  const [{ data: watchListData }] = useMarketWatchListV2Atom();
  const watchListActions = useWatchListV2Actions();
  // Favorites changed elsewhere (home, another detail page) while the modal is
  // open: reload the watchlist so these rows do not go stale, as the Market
  // home watchlist does.
  useEffect(() => {
    const refresh = async () => {
      await watchListActions.current.refreshWatchListV2();
    };
    appEventBus.on(EAppEventBusNames.RefreshMarketWatchList, refresh);
    appEventBus.on(EAppEventBusNames.MarketWatchListV2Changed, refresh);
    return () => {
      appEventBus.off(EAppEventBusNames.RefreshMarketWatchList, refresh);
      appEventBus.off(EAppEventBusNames.MarketWatchListV2Changed, refresh);
    };
  }, [watchListActions]);
  const { data, isLoading, isError, refetch } = useMarketWatchlistTokenList({
    watchlist: watchListData ?? [],
    pollingInterval: TOKEN_SELECTOR_POLLING_INTERVAL,
  });
  const spotData = useMemo(
    () => data.filter((item) => !item.perpsCoin),
    [data],
  );
  const rows = useLiveOverriddenTokens(spotData, liveTokenOverride);

  if (isLoading && rows.length === 0) {
    return <CenteredSpinner />;
  }
  if (isError && rows.length === 0) {
    return (
      <LoadErrorMessage
        testID="mobile-market-token-selector-favorites-retry"
        onRetry={() => void refetch()}
      />
    );
  }
  if (rows.length === 0) {
    return (
      <CenteredMessage>
        <SizableText color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.market_favorites_empty })}
        </SizableText>
      </CenteredMessage>
    );
  }
  return (
    <TokenRowsList data={rows} tokenSubtitle="name" onItemPress={onItemPress} />
  );
}

/** Trending / Robinhood: the Market home category list on the 24h window. */
export function MobileSelectorCategoryTokenList({
  category,
  timeRange,
  onItemPress,
  liveTokenOverride,
}: {
  category: string;
  timeRange: IMarketTimeRangeValue;
  onItemPress: (item: IMarketToken) => void;
  liveTokenOverride?: IMarketTokenListLiveOverride;
}) {
  const {
    data,
    isLoading,
    isError,
    isLoadingMore,
    canLoadMore,
    loadMore,
    refetch,
  } = useMarketTokenList({
    networkId: ALL_NETWORK_ID,
    type: category,
    useApiDefaultSort: isTrendingStyleSpotCategory(category),
    timeRange,
    pollingInterval: TOKEN_SELECTOR_POLLING_INTERVAL,
  });
  const rows = useLiveOverriddenTokens(data, liveTokenOverride);
  const handleEndReached = useCallback(() => {
    if (canLoadMore && !isLoadingMore) {
      void loadMore();
    }
  }, [canLoadMore, isLoadingMore, loadMore]);

  if (isLoading && rows.length === 0) {
    return <CenteredSpinner />;
  }
  if (isError && rows.length === 0) {
    return (
      <LoadErrorMessage
        testID="mobile-market-token-selector-category-retry"
        onRetry={() => void refetch()}
      />
    );
  }
  return (
    <TokenRowsList
      data={rows}
      tokenSubtitle="volume"
      onItemPress={onItemPress}
      onEndReached={handleEndReached}
      footer={
        isLoadingMore ? (
          <YStack py="$4" alignItems="center">
            <Spinner size="small" />
          </YStack>
        ) : null
      }
    />
  );
}

const MobileSelectorTopCoinRow = memo(
  ({
    item,
    onPress,
  }: {
    item: IMarketAssetListItem;
    onPress: (item: IMarketAssetListItem) => void;
  }) => {
    const handlePress = useCallback(() => onPress(item), [item, onPress]);
    const price = Number(item.price);
    const priceChange = Number(item.priceChange24hPercent);
    return (
      <MobileMarketSelectorListItem
        testID={MarketTestIDs.tokenListItem(item.symbol.toUpperCase())}
        tokenImageUri={item.logoUrl}
        symbol={item.symbol.toUpperCase()}
        subtitle={<NameSubtitle name={item.name ?? ''} />}
        star={
          <MarketListingStar
            kind="asset"
            listingId={item.assetId}
            from={EWatchlistFrom.Search}
          />
        }
        price={item.price ? price : undefined}
        priceChange={item.priceChange24hPercent ? priceChange : undefined}
        onPress={handlePress}
      />
    );
  },
);
MobileSelectorTopCoinRow.displayName = 'MobileSelectorTopCoinRow';

/** Top coins: the full list, asset name under the symbol, no chain badge. */
export function MobileSelectorTopCoinsList({
  data,
  isLoading,
  onItemPress,
}: {
  data: IMarketAssetListItem[];
  isLoading: boolean;
  onItemPress: (item: IMarketAssetListItem) => void;
}) {
  const renderItem = useCallback(
    ({ item }: { item: IMarketAssetListItem }) => (
      <MobileSelectorTopCoinRow item={item} onPress={onItemPress} />
    ),
    [onItemPress],
  );
  if (isLoading && data.length === 0) {
    return <CenteredSpinner />;
  }
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.assetId}
      renderItem={renderItem}
      getItemLayout={(_, index) => ({
        length: ROW_HEIGHT,
        offset: ROW_HEIGHT * index,
        index,
      })}
      initialNumToRender={12}
      maxToRenderPerBatch={20}
      windowSize={7}
      keyboardShouldPersistTaps="handled"
      style={LIST_STYLE}
    />
  );
}

export const MobileSelectorStockRow = memo(
  ({
    item,
    onPress,
  }: {
    item: IMarketStockPublicItem;
    onPress: (item: IMarketStockPublicItem) => void;
  }) => {
    const handlePress = useCallback(() => onPress(item), [item, onPress]);
    return (
      <MobileMarketSelectorListItem
        testID={MarketTestIDs.stockRow(item.stockId)}
        tokenImageUri={item.logoUrl}
        symbol={item.symbol}
        subtitle={<StockSubtitle tags={item.tags} name={item.name} />}
        star={<MarketStockStar stock={item} from={EWatchlistFrom.Search} />}
        price={parseMarketStockNumber(item.price)}
        priceChange={parseMarketStockNumber(item.priceChange24hPercent)}
        onPress={handlePress}
      />
    );
  },
);
MobileSelectorStockRow.displayName = 'MobileSelectorStockRow';

type IMobileStockSelectorListResult = ReturnType<
  typeof useMarketStockSelectorList
>;

/**
 * The stock rows for a `useMarketStockSelectorList` result, so browsing a
 * category and the search Stocks tab render the same list.
 */
export function MobileSelectorStockTable({
  result,
  onItemPress,
  listHeader,
}: {
  result: IMobileStockSelectorListResult;
  onItemPress: (item: IMarketStockPublicItem) => void;
  // Scrolls with the rows, e.g. universal search's section title.
  listHeader?: ReactElement;
}) {
  const intl = useIntl();
  const {
    items,
    isLoading,
    isError,
    isLoadingMore,
    canLoadMore,
    loadMore,
    refresh,
  } = result;
  const renderItem = useCallback(
    ({ item }: { item: IMarketStockPublicItem }) => (
      <MobileSelectorStockRow item={item} onPress={onItemPress} />
    ),
    [onItemPress],
  );
  const handleEndReached = useCallback(() => {
    if (canLoadMore && !isLoadingMore) {
      void loadMore();
    }
  }, [canLoadMore, isLoadingMore, loadMore]);

  if (isLoading && items.length === 0) {
    return <CenteredSpinner />;
  }
  if (isError && items.length === 0) {
    return (
      <CenteredMessage>
        <SizableText color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_connet_error_try_again,
          })}
        </SizableText>
        <Button
          size="small"
          variant="tertiary"
          testID="mobile-market-token-selector-stock-browse-retry"
          onPress={() => void refresh()}
        >
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      </CenteredMessage>
    );
  }
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.stockId}
      renderItem={renderItem}
      getItemLayout={(_, index) => ({
        length: ROW_HEIGHT,
        offset: ROW_HEIGHT * index,
        index,
      })}
      initialNumToRender={12}
      maxToRenderPerBatch={20}
      windowSize={7}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={listHeader}
      ListFooterComponent={
        isLoadingMore ? (
          <YStack py="$4" alignItems="center">
            <Spinner size="small" />
          </YStack>
        ) : null
      }
      keyboardShouldPersistTaps="handled"
      style={LIST_STYLE}
    />
  );
}

/** Stocks: the Market home stock list for the chosen category, paginated. */
export function MobileSelectorStockList({
  category,
  onItemPress,
}: {
  category: string;
  onItemPress: (item: IMarketStockPublicItem) => void;
}) {
  const result = useMarketStockSelectorList({ query: '', category });
  return <MobileSelectorStockTable result={result} onItemPress={onItemPress} />;
}

// Figma 27058:37054 — a search token row is three lines tall: the symbol, the
// full name with the short address, then its liquidity.
export const SEARCH_TOKEN_ROW_HEIGHT = 74;

/**
 * Liquidity, then the 24h volume when the line has room for it. A missing
 * value shows `--`: hiding it would make a token without data read like one
 * that cannot have it. Liquidity always shows in full; the volume is dropped
 * whole rather than cut to an ellipsis, which would carry no number at all.
 */
function LiquidityVolumeLine({
  liquidity,
  volume,
}: {
  liquidity: number;
  volume: number;
}) {
  const intl = useIntl();
  const [lineWidth, setLineWidth] = useState(0);
  const [liquidityWidth, setLiquidityWidth] = useState(0);
  const [volumeWidth, setVolumeWidth] = useState(0);
  // Measured widths only; until all three are known the volume stays hidden
  // so it never flashes in and back out.
  const showVolume =
    lineWidth > 0 &&
    volumeWidth > 0 &&
    liquidityWidth + volumeWidth <= lineWidth;
  const liquidityText = `${intl.formatMessage({
    id: ETranslations.dexmarket_search_result_liq,
  })} ${formatCompactUsd(liquidity) ?? '--'}`;
  const volumeValue = formatCompactUsd(volume);
  const volumeText = volumeValue
    ? intl.formatMessage(
        { id: ETranslations.market_vol_value },
        { value: volumeValue },
      )
    : intl.formatMessage(
        { id: ETranslations.market_vol_value },
        { value: '--' },
      );

  return (
    <XStack
      height={12}
      alignItems="center"
      minWidth={0}
      overflow="hidden"
      onLayout={(event) => setLineWidth(event.nativeEvent.layout.width)}
    >
      <XStack
        flexShrink={0}
        onLayout={(event) => setLiquidityWidth(event.nativeEvent.layout.width)}
      >
        <SizableText size="$bodyXs" color="$textSubdued" numberOfLines={1}>
          {liquidityText}
        </SizableText>
      </XStack>
      <XStack
        alignItems="center"
        flexShrink={0}
        // Kept in layout while hidden so its width stays measured.
        opacity={showVolume ? 1 : 0}
        onLayout={(event) => setVolumeWidth(event.nativeEvent.layout.width)}
      >
        {/* A full bullet with 6px either side, like universal search's
           Liq • Vol, reads as a separator next to the 11px figures. */}
        <SizableText size="$bodyXs" color="$textSubdued" px="$1.5">
          •
        </SizableText>
        <SizableText size="$bodyXs" color="$textSubdued" numberOfLines={1}>
          {volumeText}
        </SizableText>
      </XStack>
    </XStack>
  );
}

/**
 * A search result token. Mobile shows no copy button; a native coin (no
 * contract address) keeps two lines — symbol and full name — with no address
 * or liquidity and volume line.
 */
export const MobileSelectorSearchTokenRow = memo(
  ({ item, onPress }: { item: IMarketToken; onPress: () => void }) => {
    const handlePressIn = useCallback(
      () => prewarmMarketTokenImages(item),
      [item],
    );
    const displayName = item.name.trim();
    const isNativeCoin = !item.address;
    const subtitle = isNativeCoin ? (
      <NameSubtitle name={displayName} />
    ) : (
      <YStack gap="$1" minWidth={0}>
        <XStack height={12} alignItems="center" gap="$1.5" minWidth={0}>
          {displayName ? (
            <SizableText
              size="$bodyXs"
              color="$textSubdued"
              numberOfLines={1}
              flexShrink={1}
            >
              {displayName}
            </SizableText>
          ) : null}
          <SizableText
            size="$bodyXs"
            color="$textDisabled"
            numberOfLines={1}
            flexShrink={0}
          >
            {accountUtils.shortenAddress({
              address: item.address,
              leadingLength: 6,
              trailingLength: 4,
            })}
          </SizableText>
        </XStack>
        <LiquidityVolumeLine
          liquidity={item.liquidity}
          volume={item.turnover}
        />
      </YStack>
    );
    return (
      <MobileMarketSelectorListItem
        testID={MarketTestIDs.tokenListItem(item.symbol)}
        tokenImageUri={item.tokenImageUri}
        tokenImageUris={item.tokenImageUris}
        networkLogoUri={item.networkLogoUri}
        networkId={item.networkId}
        symbol={item.symbol}
        communityRecognized={item.communityRecognized}
        subtitle={subtitle}
        price={item.price}
        priceChange={getTokenPriceChange(item)}
        height={isNativeCoin ? ROW_HEIGHT : SEARCH_TOKEN_ROW_HEIGHT}
        star={<SelectorTokenStar item={item} />}
        nameGap={isNativeCoin ? '$1' : '$0.5'}
        onPress={onPress}
        onPressIn={handlePressIn}
      />
    );
  },
);
MobileSelectorSearchTokenRow.displayName = 'MobileSelectorSearchTokenRow';

function SkeletonLine({
  lineHeight,
  h,
  w,
}: {
  lineHeight: number;
  h: '$2.5' | '$3';
  w: '$12' | '$16' | '$32';
}) {
  return (
    <Stack height={lineHeight} justifyContent="center">
      <Skeleton h={h} w={w} />
    </Stack>
  );
}

const SEARCH_SKELETON_ROW_COUNT = 8;

/**
 * Shown for the whole result area until both searches answer, like
 * universal search: the sections then appear at once instead of the late
 * one pushing the other down. It mirrors a section title and the rows.
 */
export function MobileSelectorSearchSkeleton() {
  return (
    <YStack pt="$2.5">
      <XStack px="$5" py="$2">
        <SkeletonLine lineHeight={20} h="$3" w="$16" />
      </XStack>
      {Array.from({ length: SEARCH_SKELETON_ROW_COUNT }, (_, index) => (
        <XStack
          key={index}
          height={ROW_HEIGHT}
          px="$5"
          py="$2"
          gap="$3"
          alignItems="center"
        >
          <XStack alignItems="center" gap={TOKEN_SELECTOR_NAME_GAP}>
            <Stack
              width={TOKEN_SELECTOR_STAR_COLUMN_WIDTH}
              ml={STAR_SLOT_GUTTER_OFFSET}
              alignItems="center"
              justifyContent="center"
            >
              <Skeleton w="$4" h="$4" radius="round" />
            </Stack>
            <Skeleton w="$8" h="$8" radius="round" />
          </XStack>
          <YStack flex={1} gap="$1">
            <SkeletonLine lineHeight={24} h="$3" w="$16" />
            <SkeletonLine lineHeight={16} h="$2.5" w="$32" />
          </YStack>
          <YStack alignItems="flex-end" gap="$1">
            <SkeletonLine lineHeight={24} h="$3" w="$16" />
            <SkeletonLine lineHeight={16} h="$2.5" w="$12" />
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}
