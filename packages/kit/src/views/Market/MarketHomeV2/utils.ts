// Shared utility functions for MarketHomeV2 components

import {
  MARKET_CATEGORY_WITHOUT_NETWORK_FILTER_ID,
  MARKET_TOP_COINS_CATEGORY_ID,
} from '@onekeyhq/shared/src/consts/marketConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IMarketCategoryItem, IMarketTimeRangeValue } from './types';

// Lists whose metrics are always 24h still label their columns through the
// same ranged phrases the trending table interpolates, so every list reads
// the same way instead of mixing "24h volume" with "24h 交易量".
export const MARKET_FIXED_24H_RANGE: IMarketTimeRangeValue = '24h';
// Not an `IMarketTimeRangeValue`: no list offers 7d in its range dropdown,
// it is only ever a fixed column.
export const MARKET_FIXED_7D_RANGE = '7d';

const SPOT_CATEGORIES_WITH_FULL_STATS = new Set(['trending', 'x_mentioned']);
const TRENDING_STYLE_SPOT_CATEGORY_IDS = new Set([
  'trending',
  'robinhood_meme',
]);

export const COMPACT_SPOT_HIDDEN_DESKTOP_COLUMNS = [
  'transactions',
  'uniqueTraders',
  'holders',
  'tokenAge',
] as const;

/**
 * Validate liquidity input to only allow numbers and k/m/b/t/K/M/B/T characters
 * Unit letters can only appear at the end and only one unit is allowed
 * @param value - Input string to validate
 * @returns True if valid, false otherwise
 */
export const validateLiquidityInput = (value: string): boolean => {
  // Pattern: numbers followed by optional single unit at the end
  const validPattern = /^[0-9]*[kmbtKMBT]?$/;
  return validPattern.test(value);
};

/**
 * Parse a string value to number, supporting K/k (thousands), M/m (millions), B/b (billions), T/t (trillions) suffixes
 * Unit letters can only appear at the end and only one unit is allowed
 * @param value - String value like "10K", "5M", "2B", "1T", "1000"
 * @returns Parsed numeric value, or 0 when the input is invalid
 */
export const parseValueToNumber = (value: string): number => {
  if (!value || value.trim() === '') {
    return 0;
  }

  const trimmedValue = value.trim();

  // Check if last character is a unit
  const lastChar = trimmedValue.slice(-1).toLowerCase();
  const isUnit = ['k', 'm', 'b', 't'].includes(lastChar);

  if (isUnit) {
    // Extract number part (everything except the last character)
    const numberPart = trimmedValue.slice(0, -1);

    if (!numberPart || numberPart === '') {
      return 0;
    }

    const numValue = Number(numberPart);
    if (!Number.isFinite(numValue)) {
      return 0;
    }

    switch (lastChar) {
      case 't':
        return numValue * 1_000_000_000_000; // trillion
      case 'b':
        return numValue * 1_000_000_000; // billion
      case 'm':
        return numValue * 1_000_000; // million
      case 'k':
        return numValue * 1000; // thousand
      default:
        return numValue;
    }
  } else {
    // No unit, just parse as number
    const numValue = Number(trimmedValue);
    return Number.isFinite(numValue) ? numValue : 0;
  }
};

/**
 * Format liquidity filter values for display
 * @param filter - Liquidity filter object with min and max values
 * @param liquidityText - Translated liquidity text
 * @returns Formatted string for button display
 */
export const formatLiquidityFilterDisplay = (
  filter?: {
    min?: string;
    max?: string;
  },
  liquidityText = 'Liquidity',
): string => {
  if (!filter || (!filter.min && !filter.max)) {
    return liquidityText;
  }

  const { min, max } = filter;

  // Clean up empty strings
  const cleanMin = min?.trim();
  const cleanMax = max?.trim();

  if (cleanMin && cleanMax) {
    return `${liquidityText}: ${cleanMin} - ${cleanMax}`;
  }

  if (cleanMin && !cleanMax) {
    return `${liquidityText}: ≥ ${cleanMin}`;
  }

  if (!cleanMin && cleanMax) {
    return `${liquidityText}: ≤ ${cleanMax}`;
  }

  return liquidityText;
};

/**
 * Validate if the liquidity minimum value does not exceed maximum allowed (1t = 1 trillion)
 * @param value - String value to validate
 * @returns True if value is <= 1t or empty, false otherwise
 */
export const validateMaximumMinLiquidity = (value: string): boolean => {
  if (!value || value.trim() === '') {
    return true; // Empty values are allowed
  }

  const numValue = parseValueToNumber(value.trim());
  const maximumMinValue = 1_000_000_000_000; // 1 trillion

  return numValue <= maximumMinValue;
};

/**
 * Spot categories backed by per-token OKX detail APIs only expose a compact
 * metric set, so desktop list pages should hide the extended stats columns to
 * match watchlist behavior.
 */
export const shouldHideSpotExtendedStats = (
  selectedCategory?: string,
): boolean => {
  const normalizedCategory = selectedCategory || 'trending';
  return !SPOT_CATEGORIES_WITH_FULL_STATS.has(normalizedCategory);
};

export const shouldShowSpotNetworkSelector = (categoryId?: string): boolean =>
  categoryId !== MARKET_CATEGORY_WITHOUT_NETWORK_FILTER_ID;

export const isTrendingStyleSpotCategory = (
  categoryId: string | undefined,
): boolean =>
  Boolean(categoryId && TRENDING_STYLE_SPOT_CATEGORY_IDS.has(categoryId));

export const isMarketStockCategory = (
  category?: Pick<IMarketCategoryItem, 'id' | 'name' | 'isStockCategory'>,
): boolean => {
  if (!category) {
    return false;
  }

  if (category.isStockCategory) {
    return true;
  }

  const normalizedId = category.id.trim().toLowerCase();
  const normalizedName = category.name.trim().toLowerCase();

  return (
    normalizedId.includes('stock') ||
    normalizedName.includes('stock') ||
    normalizedName.includes('股票')
  );
};

// Work order 2026-09-08 §5. Favorites and Perps carry no copy, so they fall
// through and their tabs stay plain.
const CATEGORY_TOOLTIP_IDS: Record<string, ETranslations> = {
  trending: ETranslations.market_tab_trending_tooltip,
  // oxlint-disable-next-line @cspell/spellchecker
  robinhood_meme: ETranslations.market_tab_robinhood_tooltip,
  [MARKET_TOP_COINS_CATEGORY_ID]: ETranslations.market_tab_top_coins_tooltip,
};

export const getMarketCategoryTooltipId = (
  category: Pick<IMarketCategoryItem, 'id' | 'name' | 'isStockCategory'>,
): ETranslations | undefined => {
  // Stocks is a set of API categories rather than one fixed id, so it is
  // matched by the same predicate the rest of the module uses.
  if (isMarketStockCategory(category)) {
    return ETranslations.market_tab_stocks_tooltip;
  }
  return CATEGORY_TOOLTIP_IDS[category.id];
};

export const isMarketStockCategoryById = (
  categories: IMarketCategoryItem[] | undefined,
  categoryId: string | undefined,
): boolean => {
  if (!categoryId || !categories?.length) {
    return false;
  }

  return categories.some(
    (category) => category.id === categoryId && isMarketStockCategory(category),
  );
};

export const ensureMarketTopCoinsCategory = (
  categories: IMarketCategoryItem[],
  fallbackName: string,
): IMarketCategoryItem[] => {
  if (
    categories.some((category) => category.id === MARKET_TOP_COINS_CATEGORY_ID)
  ) {
    return categories;
  }

  const topCoinsCategory: IMarketCategoryItem = {
    id: MARKET_TOP_COINS_CATEGORY_ID,
    name: fallbackName,
  };

  // The tab strip runs Favorites, Trending, Stocks, Top coins, Perps. Perps is
  // appended after every spot category, so Top coins goes last among them.
  return [...categories, topCoinsCategory];
};
