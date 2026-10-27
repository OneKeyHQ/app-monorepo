import type { IMarketPerpsToken } from './hooks/marketPerpsTokenUtils';

export const MARKET_PERPS_DEFAULT_CATEGORY_ID = 'crypto';

// The numeric columns the design marks sortable, keyed by their `dataIndex`.
// Shared by the Perps tab and the banner detail perps section.
export const PERPS_SORTABLE_FIELDS: Record<string, keyof IMarketPerpsToken> = {
  price: 'markPrice',
  change24h: 'change24hPercent',
  fundingRate: 'fundingRate',
  volume24h: 'volume24h',
  openInterest: 'openInterest',
};

export const PERPS_METRIC_COLUMN_MINIMUM_WIDTHS = {
  change24h: 168,
  fundingRate: 112,
  openInterest: 112,
  price: 112,
  volume24h: 112,
} as const;
