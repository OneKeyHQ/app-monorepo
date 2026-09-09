import { isEqual } from 'lodash';

import {
  numberFormat,
  numberFormatAsRenderText,
} from '@onekeyhq/shared/src/utils/numberUtils';
import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { parseMarketStockNumber } from '../MarketStockList/utils';

import type { IMarketPerpsToken } from '../MarketPerpsList/hooks/useMarketPerpsTokenList';
import type { IMarketToken } from '../MarketTokenList/MarketTokenData';
import type {
  ImageSource,
  MarketBadgeModel,
  MarketChangeModel,
  MarketRow,
  MarketRowStyle,
  NativeListSnapshot,
  NativeListTheme,
  RowModel,
  RowPatch,
  ValueTextSegment,
} from '@onekeyfe/react-native-native-list';

export type IMarketNativeListPresentation = Readonly<{
  theme: NativeListTheme;
  communityRecognizedAccessibilityLabel: string;
  leverageAccessibilityLabel: string;
  providerAccessibilityLabel: string;
  positiveBackground: string;
  negativeBackground: string;
  neutralBackground: string;
  infoBackground: string;
  infoText: string;
}>;

const TOKEN_ROW_STYLE: MarketRowStyle = {
  horizontalPadding: 20,
  verticalPadding: 12,
  leadingGap: 14,
  lineGap: 4,
  titleBadgeGap: 4,
  trailingGap: 8,
  image: {
    width: 32,
    height: 32,
    shape: 'circle',
    cornerRadius: 16,
    contentFit: 'cover',
  },
  title: {
    fontSize: 16,
    fontWeight: 'medium',
    lineHeight: 24,
    lines: 1,
    alignment: 'start',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: 'regular',
    lineHeight: 20,
    lines: 1,
    alignment: 'start',
  },
  price: {
    fontSize: 16,
    fontWeight: 'medium',
    lineHeight: 24,
    lines: 1,
    alignment: 'end',
  },
  change: {
    fontSize: 14,
    fontWeight: 'medium',
    lineHeight: 20,
    lines: 1,
    alignment: 'center',
  },
  changeWidth: 80,
  changeHeight: 32,
  changeCornerRadius: 8,
};

const STOCK_ROW_STYLE: MarketRowStyle = {
  ...TOKEN_ROW_STYLE,
  lineGap: 0,
  image: {
    width: 40,
    height: 40,
    shape: 'circle',
    cornerRadius: 20,
    contentFit: 'cover',
  },
};

const PERP_ROW_STYLE: MarketRowStyle = {
  ...TOKEN_ROW_STYLE,
  horizontalPadding: 16,
  leadingGap: 8,
};

function toTextSegments(rendered: ReturnType<typeof numberFormatAsRenderText>):
  | Readonly<{
      text: string;
      textSegments?: readonly ValueTextSegment[];
    }>
  | undefined {
  if (!rendered) return undefined;
  if (typeof rendered === 'string') return { text: rendered };
  const textSegments = rendered.map<ValueTextSegment>((segment) =>
    typeof segment === 'string'
      ? { text: segment }
      : {
          text: String(segment.value),
          ...(segment.type === 'sub' ? { style: 'subscript' as const } : {}),
        },
  );
  return {
    text: textSegments.map((segment) => segment.text).join(''),
    textSegments,
  };
}

function formatNumber(
  value: string | number | undefined,
  formatter: 'price' | 'priceChangeCapped' | 'marketCap',
  formatterOptions?: {
    currency?: string;
    showPlusMinusSigns?: boolean;
  },
) {
  if (value === undefined || value === null || value === '') {
    return { text: '--' } as const;
  }
  const rendered = numberFormatAsRenderText(String(value), {
    formatter,
    formatterOptions,
  });
  return toTextSegments(rendered) ?? ({ text: '--' } as const);
}

function formatSubtitle(
  label: string | undefined,
  volume: string | number | undefined,
) {
  const numericVolume = Number(volume);
  const volumeText =
    Number.isFinite(numericVolume) && numericVolume !== 0
      ? numberFormat(String(volume), {
          formatter: 'marketCap',
          formatterOptions: { currency: '$' },
        })
      : undefined;
  return [label, volumeText].filter(Boolean).join(' ') || undefined;
}

function marketImage(
  uri: string | undefined,
  size: number,
): ImageSource | undefined {
  if (!uri || uri.toLowerCase().includes('svg')) return undefined;
  return {
    uri,
    width: size,
    height: size,
    contentFit: 'cover' as const,
    cachePolicy: 'memory-disk' as const,
    retryTimes: 2,
  };
}

function firstNativeImageUri(item: IMarketToken) {
  return [item.tokenImageUri, ...(item.tokenImageUris ?? [])].find(
    (uri) => uri && !uri.toLowerCase().includes('svg'),
  );
}

function tokenBadges(
  item: IMarketToken,
  presentation: IMarketNativeListPresentation,
): readonly MarketBadgeModel[] {
  const badges: MarketBadgeModel[] = [];
  if (item.communityRecognized) {
    badges.push({
      key: `${marketTokenKey(item)}:community`,
      iconName: 'verified',
      tone: 'success',
      actionKey: 'token-tags',
      accessibilityLabel: `${item.symbol}, ${presentation.communityRecognizedAccessibilityLabel}`,
    });
  }
  if (item.stock?.sourceLogoUri) {
    badges.push({
      key: `${marketTokenKey(item)}:stock-source`,
      icon: marketImage(item.stock.sourceLogoUri, 14),
      tone: 'neutral',
      actionKey: 'token-tags',
      accessibilityLabel: item.stock.title || item.stock.subtitle,
    });
  }
  return badges;
}

function perpsBadges({
  key,
  maxLeverage,
  dexLabel,
  presentation,
}: {
  key: string;
  maxLeverage?: number;
  dexLabel?: string;
  presentation: IMarketNativeListPresentation;
}): readonly MarketBadgeModel[] {
  const badges: MarketBadgeModel[] = [];
  if (maxLeverage) {
    badges.push({
      key: `${key}:leverage`,
      text: `${maxLeverage}x`,
      tone: 'info',
      textColor: presentation.infoText,
      backgroundColor: presentation.infoBackground,
      accessibilityLabel: `${maxLeverage}x, ${presentation.leverageAccessibilityLabel}`,
    });
  }
  const normalizedDexLabel = dexLabel?.toLowerCase();
  if (
    normalizedDexLabel === 'xyz' ||
    normalizedDexLabel === 'para' ||
    normalizedDexLabel === 'io'
  ) {
    badges.push({
      key: `${key}:dex`,
      text: normalizedDexLabel,
      tone: 'info',
      textColor: presentation.infoText,
      backgroundColor: presentation.infoBackground,
      actionKey: 'perps-dex-info',
      accessibilityLabel: `${normalizedDexLabel}, ${presentation.providerAccessibilityLabel}`,
    });
  }
  return badges;
}

function buildChange(
  value: string | number | undefined,
  presentation: IMarketNativeListPresentation,
): MarketChangeModel {
  const isPlaceholder = value === '-';
  const numericValue = isPlaceholder ? Number.NaN : Number(value);
  let tone: MarketChangeModel['tone'] = 'neutral';
  if (Number.isFinite(numericValue) && numericValue !== 0) {
    tone = numericValue > 0 ? 'positive' : 'negative';
  }
  const formatted =
    isPlaceholder || !Number.isFinite(numericValue)
      ? ({ text: '--' } as const)
      : formatNumber(numericValue, 'priceChangeCapped', {
          showPlusMinusSigns: true,
        });
  let backgroundColor = presentation.neutralBackground;
  if (tone === 'positive') {
    backgroundColor = presentation.positiveBackground;
  } else if (tone === 'negative') {
    backgroundColor = presentation.negativeBackground;
  }
  return {
    ...formatted,
    tone,
    textColor: presentation.theme.inverseText,
    backgroundColor,
  };
}

function rowStyleForChange(
  style: MarketRowStyle,
  change: number | undefined,
): MarketRowStyle {
  return {
    ...style,
    change: {
      ...style.change,
      fontSize: Math.abs(change ?? 0) >= 10_000 ? 13 : 14,
    },
  };
}

export function marketTokenKey(item: IMarketToken) {
  return item.perpsCoin
    ? `perps:${item.perpsCoin}`
    : `${item.networkId}:${(item.address || '').toLowerCase()}:${item.isNative ? 1 : 0}`;
}

export function buildTokenMarketRow({
  item,
  presentation,
  watchlist = false,
}: {
  item: IMarketToken;
  presentation: IMarketNativeListPresentation;
  watchlist?: boolean;
}): MarketRow {
  const key = marketTokenKey(item);
  const isPerp = Boolean(item.perpsCoin);
  const price = formatNumber(item.price, 'price', { currency: '$' });
  const rawChange = item.priceChangeRaw === '-' ? '-' : item.change24h;
  const change = buildChange(rawChange, presentation);
  const dexLabel = item.perpsCoin
    ? parseDexCoin(item.perpsCoin).dexLabel
    : undefined;
  const style = isPerp ? PERP_ROW_STYLE : TOKEN_ROW_STYLE;
  return {
    key,
    type: 'market',
    variant: isPerp ? 'perp' : 'token',
    height: 72,
    testID: `market-token-item-${item.symbol}`,
    accessibilityLabel: `${item.symbol}, ${price.text}, ${change.text}`,
    leading: {
      kind: 'token',
      image: marketImage(firstNativeImageUri(item), 32),
      networkImage: isPerp ? undefined : marketImage(item.networkLogoUri, 16),
      fallbackIcon: { name: 'CryptoCoinOutline' },
      shape: 'circle',
      backgroundColor: presentation.theme.strongBackground,
    },
    title: item.symbol,
    subtitle: formatSubtitle(
      item.stock?.subtitle ?? item.perpsSubtitle,
      item.turnover,
    ),
    price: price.text,
    priceSegments: price.textSegments,
    change,
    badges: isPerp
      ? perpsBadges({
          key,
          maxLeverage: item.maxLeverage,
          dexLabel,
          presentation,
        })
      : tokenBadges(item, presentation),
    pressActionKey: 'open-detail',
    pressInActionKey: isPerp ? undefined : 'prewarm-detail',
    longPressActionKey: watchlist ? 'watchlist-menu' : undefined,
    style: rowStyleForChange(style, Number(rawChange)),
  };
}

export function buildStockMarketRow({
  item,
  presentation,
}: {
  item: IMarketStockPublicItem;
  presentation: IMarketNativeListPresentation;
}): MarketRow {
  const priceValue = parseMarketStockNumber(item.price);
  const changeValue = parseMarketStockNumber(item.priceChange24hPercent);
  const price = formatNumber(priceValue, 'price', { currency: '$' });
  const change = buildChange(changeValue, presentation);
  return {
    key: item.stockId,
    type: 'market',
    variant: 'stock',
    height: 72,
    testID: `market-stock-row-${item.stockId}`,
    accessibilityLabel: `${item.symbol}, ${price.text}, ${change.text}`,
    leading: {
      kind: 'token',
      image: marketImage(item.logoUrl, 40),
      fallbackIcon: { name: 'CryptoCoinOutline' },
      shape: 'circle',
      backgroundColor: presentation.theme.strongBackground,
    },
    title: item.symbol,
    subtitle: item.name,
    price: price.text,
    priceSegments: price.textSegments,
    change,
    pressActionKey: 'open-detail',
    pressInActionKey: 'prewarm-stock-detail',
    style: rowStyleForChange(STOCK_ROW_STYLE, changeValue),
  };
}

export function buildPerpsMarketRow({
  item,
  presentation,
}: {
  item: IMarketPerpsToken;
  presentation: IMarketNativeListPresentation;
}): MarketRow {
  const price = formatNumber(item.markPrice, 'price', { currency: '$' });
  const change = buildChange(item.change24hPercent, presentation);
  return {
    key: item.name,
    type: 'market',
    variant: 'perp',
    height: 72,
    testID: `market-perps-row-${item.name}`,
    accessibilityLabel: `${item.displayName}, ${price.text}, ${change.text}`,
    leading: {
      kind: 'token',
      image: marketImage(item.tokenImageUrl, 32),
      fallbackIcon: { name: 'CryptoCoinOutline' },
      shape: 'circle',
      backgroundColor: presentation.theme.strongBackground,
    },
    title: item.displayName,
    subtitle: formatSubtitle(item.subtitle, item.volume24h),
    price: price.text,
    priceSegments: price.textSegments,
    change,
    badges: perpsBadges({
      key: item.name,
      maxLeverage: item.maxLeverage,
      dexLabel: item.dexLabel,
      presentation,
    }),
    pressActionKey: 'open-detail',
    style: rowStyleForChange(PERP_ROW_STYLE, item.change24hPercent),
  };
}

export function buildTopCoinMarketRow({
  item,
  presentation,
}: {
  item: IMarketAssetListItem;
  presentation: IMarketNativeListPresentation;
}): MarketRow {
  const price = formatNumber(item.price, 'price', { currency: '$' });
  const change = buildChange(item.priceChange24hPercent, presentation);
  const symbol = item.symbol.toUpperCase();
  return {
    key: item.assetId,
    type: 'market',
    variant: 'token',
    height: 72,
    testID: `market-token-item-${symbol}`,
    accessibilityLabel: `${symbol}, ${price.text}, ${change.text}`,
    leading: {
      kind: 'token',
      image: marketImage(item.logoUrl, 32),
      fallbackIcon: { name: 'CryptoCoinOutline' },
      shape: 'circle',
      backgroundColor: presentation.theme.strongBackground,
    },
    title: symbol,
    subtitle: formatSubtitle(undefined, item.volume24h),
    price: price.text,
    priceSegments: price.textSegments,
    change,
    pressActionKey: 'open-detail',
    style: rowStyleForChange(
      TOKEN_ROW_STYLE,
      Number(item.priceChange24hPercent),
    ),
  };
}

export function buildMarketNativeSnapshot({
  rows: marketRows,
  generation,
  presentation,
  loading,
  refreshing,
  loadingMore,
  loadMoreError,
  errorMessage,
  noDataMessage,
  retryMessage,
  canLoadMore,
  canRefresh,
  showEnd = true,
  contentPaddingBottom,
}: {
  rows: readonly MarketRow[];
  generation: number;
  presentation: IMarketNativeListPresentation;
  loading: boolean;
  refreshing?: boolean;
  loadingMore?: boolean;
  loadMoreError?: boolean;
  errorMessage?: string;
  noDataMessage: string;
  retryMessage: string;
  canLoadMore?: boolean;
  canRefresh?: boolean;
  showEnd?: boolean;
  contentPaddingBottom: number;
}): NativeListSnapshot {
  let rows: RowModel[] = [...marketRows];
  if (loading && rows.length === 0) {
    rows = Array.from({ length: 10 }, (_, index) => ({
      key: `market-loading-${index}`,
      height: 56,
      type: 'system' as const,
      variant: 'loading' as const,
      presentation: 'market' as const,
      loadingStyle: 'skeleton' as const,
    }));
  } else if (errorMessage && rows.length === 0) {
    rows = [
      {
        key: 'market-retry',
        type: 'system',
        variant: 'retry',
        presentation: 'market',
        message: errorMessage,
        actionKey: 'retry',
      },
    ];
  } else if (loadingMore) {
    rows.push({
      key: 'market-loading-more',
      height: 52,
      type: 'system',
      variant: 'loading',
      presentation: 'market',
      loadingStyle: 'spinner',
    });
  } else if (loadMoreError) {
    rows.push({
      key: 'market-load-more-retry',
      type: 'system',
      variant: 'retry',
      presentation: 'market',
      message: retryMessage,
      actionKey: 'load-more-retry',
    });
  } else if (showEnd && !canLoadMore && rows.length > 0) {
    rows.push({
      key: 'market-end',
      height: 36,
      type: 'system',
      variant: 'end',
      presentation: 'market',
    });
  }

  return {
    schemaVersion: 1,
    generation,
    theme: presentation.theme,
    layout: {
      kind: 'linear',
      contentPaddingTop: 0,
      contentPaddingBottom,
      contentPaddingHorizontal: 0,
      itemSpacing: 0,
    },
    rows,
    selection: { mode: 'none', selectedKeys: [] },
    capabilities: {
      pullToRefresh: Boolean(canRefresh),
      refreshing: Boolean(canRefresh && refreshing),
      loadMore: Boolean(canLoadMore),
      endReachedThreshold: 0.2,
    },
    emptyState: {
      key: 'market-empty',
      height: 88,
      type: 'system',
      variant: 'noMatch',
      presentation: 'market',
      message: noDataMessage,
    },
  };
}

const MARKET_PATCH_FIELDS = new Set<keyof MarketRow>([
  'price',
  'priceSegments',
  'change',
  'style',
  'accessibilityLabel',
]);

export function buildMarketNativeRowPatches(
  previous: NativeListSnapshot,
  next: NativeListSnapshot,
): RowPatch[] | undefined {
  if (previous === next) return [];
  const { rows: previousRows, ...previousMetadata } = previous;
  const { rows: nextRows, ...nextMetadata } = next;
  if (
    previousRows.length !== nextRows.length ||
    !isEqual(previousMetadata, nextMetadata)
  ) {
    return undefined;
  }
  const patches: RowPatch[] = [];
  for (let index = 0; index < nextRows.length; index += 1) {
    const row = nextRows[index];
    const previousRow = previousRows[index];
    if (!isEqual(row, previousRow)) {
      if (
        !previousRow ||
        row.key !== previousRow.key ||
        row.type !== 'market' ||
        previousRow.type !== 'market'
      ) {
        return undefined;
      }
      const fields = new Set([
        ...Object.keys(previousRow),
        ...Object.keys(row),
      ] as (keyof MarketRow)[]);
      const changes: Record<string, unknown> = {};
      for (const field of fields) {
        if (!isEqual(row[field], previousRow[field])) {
          if (!MARKET_PATCH_FIELDS.has(field) || row[field] === undefined) {
            return undefined;
          }
          changes[field] = row[field];
        }
      }
      if (Object.keys(changes).length) {
        patches.push({
          type: 'market',
          key: row.key,
          changes: changes as Extract<RowPatch, { type: 'market' }>['changes'],
        });
      }
    }
  }
  return patches;
}
