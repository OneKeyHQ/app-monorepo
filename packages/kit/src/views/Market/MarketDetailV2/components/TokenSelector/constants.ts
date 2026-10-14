import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';

import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';

export const TOKEN_SELECTOR_POLLING_INTERVAL = timerUtils.getTimeDurationMs({
  seconds: 15,
});

// Figma 27032:42467 — a 16px label line inside 10px vertical padding, and
// 64px body rows.
export const TOKEN_SELECTOR_HEADER_HEIGHT = 36;
export const TOKEN_SELECTOR_ROW_HEIGHT = 64;
// The table sits 12px inside the popover so the rounded row hover leaves a
// margin; the cells' own 8px padding lands the content on the 20px gutter the
// search field, tabs and chips share.
export const TOKEN_SELECTOR_TABLE_PADDING = 12;
export const TOKEN_SELECTOR_CONTENT_GUTTER = '$5' as const;
// Space under the last row of a scrolled-to-end list, matching the gutter.
export const TOKEN_SELECTOR_LIST_PADDING_BOTTOM = 20;
// The search sections' full-width Show more row.
export const TOKEN_SELECTOR_SHOW_MORE_HEIGHT = 44;

export const TOKEN_SELECTOR_HIDDEN_DESKTOP_COLUMNS = [
  'liquidity',
  'transactions',
  'uniqueTraders',
  'holders',
  'tokenAge',
] as const;

// The header "#" cell and the row star share this box so the star centers
// under "#" and every name cell starts the logo where the header label starts.
export const TOKEN_SELECTOR_STAR_COLUMN_WIDTH = 24;
export const TOKEN_SELECTOR_NAME_GAP = '$1.5' as const;
export const TOKEN_SELECTOR_COLUMN_PADDING = '$2' as const;

export const TOKEN_SELECTOR_POPOVER_WIDTH = 800;

// The chip band under the tabs: 6px above and 10px below a 32px chip row.
export const TOKEN_SELECTOR_TOOLBAR_HEIGHT = 48;

// The popover's fixed height before and after typing; the list or search
// results below the tabs fill whatever is left, so switching tabs, chips or
// starting to type never resizes it.
export const TOKEN_SELECTOR_POPOVER_HEIGHT = 600;

// With results in more than one section, the search All tab previews this
// many rows per section. A stock query rarely returns more than a couple of
// listings, so the limit mostly lets the token section show the common
// variants of one asset (chains, wrappers, issuers) before Show more.
export const TOKEN_SELECTOR_SEARCH_SECTION_PREVIEW_ROWS = 5;

// The space between a search All tab's sections, above a stock or token one;
// the same 10px stays fixed under the tab bar above every search tab.
export const TOKEN_SELECTOR_SEARCH_SECTION_GAP = 10;

// The browse lists' name column. With the figures right-aligned the name has
// room to spare, so it runs narrower than the design's 288 `Left Fixed` frame.
// The stocks table keeps the same width so the tabs line up.
export const TOKEN_SELECTOR_NAME_COLUMN_WIDTH = 256;

// Search results put the full name and the address side by side, so their
// name column runs wider than the browse lists'.
export const TOKEN_SELECTOR_SEARCH_NAME_COLUMN_WIDTH = 312;

export type IMarketTokenSelectorMetricColumn =
  | 'price'
  | 'change'
  // Price over its 24h change in one cell (search results).
  | 'priceChange'
  | 'marketCap'
  | 'liquidity'
  | 'turnover';

/**
 * `favorites` and `coins` (top coins, search) carry 24h listing metrics,
 * `trending` covers the v2 category list (Trending / Robinhood). Header labels
 * and row cells both map over these lists so the two can never drift apart.
 */
export type IMarketTokenSelectorColumnVariant =
  | 'favorites'
  | 'coins'
  | 'trending'
  | 'search';

export const TOKEN_SELECTOR_METRIC_COLUMNS: Record<
  IMarketTokenSelectorColumnVariant,
  IMarketTokenSelectorMetricColumn[]
> = {
  favorites: ['price', 'change', 'turnover'],
  coins: ['price', 'change', 'marketCap', 'turnover'],
  trending: ['marketCap', 'price', 'change', 'liquidity', 'turnover'],
  search: ['liquidity', 'priceChange', 'marketCap', 'turnover'],
};

/**
 * Relative widths of the metric columns; unlisted columns weigh 1. Trending
 * and Robinhood fit five metrics, so the two whose values run widest — small
 * prices like `$0.0004657` and changes like `+20,028.32%` — take a larger
 * share than the compact `$1.2M`-style amounts beside them.
 */
export const TOKEN_SELECTOR_METRIC_FLEX: Record<
  IMarketTokenSelectorColumnVariant,
  Partial<Record<IMarketTokenSelectorMetricColumn, number>>
> = {
  favorites: {},
  coins: {},
  trending: { price: 1.25, change: 1.25 },
  // The price-over-change cell and its long header take a larger share.
  search: { priceChange: 1.25 },
};

export interface IMarketTokenSelectorColumns {
  metrics: IMarketTokenSelectorMetricColumn[];
  flex: Partial<Record<IMarketTokenSelectorMetricColumn, number>>;
}

// Default all-networks ID (constant, never changes)
export const ALL_NETWORK_ID = getNetworkIdsMap().onekeyall;

export function getSelectorSearchAssetId(
  item: Pick<
    IMarketSearchV2Token,
    'assetId' | 'network' | 'address' | 'isNative'
  >,
): string | undefined {
  // A concrete chain token must not be replaced by the asset's default variant.
  const hasChainIdentity = Boolean(
    item.network?.trim() && (item.address?.trim() || item.isNative),
  );
  return hasChainIdentity ? undefined : item.assetId;
}

// Shared search token → market token converter
export function convertSearchTokenToMarketToken(
  item: IMarketSearchV2Token & { networkLogoURI: string },
): IMarketToken {
  return {
    id:
      item.assetId && !item.network && !item.address
        ? `market_asset_${item.assetId}`
        : `${item.network}_${item.address}`,
    assetId: getSelectorSearchAssetId(item),
    name: item.name,
    symbol: item.symbol,
    address: item.address,
    decimals: item.decimals,
    price: Number(item.price) || 0,
    change24h: Number(item.priceChange24hPercent) || 0,
    // Carried raw so a '-' (no data) can be told apart from a real 0% after
    // the numeric normalization above.
    priceChangeRaw: item.priceChange24hPercent,
    marketCap: Number(item.marketCap) || 0,
    liquidity: Number(item.liquidity) || 0,
    transactions: 0,
    uniqueTraders: 0,
    holders: 0,
    turnover: Number(item.volume_24h || item.volume24h) || 0,
    tokenImageUri: item.logoUrl,
    tokenImageUris: item.logoUrls,
    networkLogoUri: item.networkLogoURI,
    networkId: item.network,
    chainId: item.network,
    isNative: item.isNative,
    communityRecognized: item.communityRecognized,
    stock: item.stock,
    stockId: item.stockId,
  };
}
