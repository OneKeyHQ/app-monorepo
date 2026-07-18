import { EMarketFilterField } from './marketListFilterTypes';

import type {
  IMarketFilterFieldConfig,
  IMarketFilterPreset,
} from './marketListFilterTypes';

const H = 60 * 60 * 1000;
const M = 60 * 1000;

const fmtUsd = (v: number) => {
  if (v >= 1_000_000_000) return `$${v / 1_000_000_000}B`;
  if (v >= 1_000_000) return `$${v / 1_000_000}M`;
  if (v >= 1000) return `$${v / 1000}K`;
  return `$${v}`;
};
const fmtCount = (v: number) => (v >= 1000 ? `${v / 1000}K` : `${v}`);
const fmtAge = (v: number) => {
  if (v >= 24 * H) return `${v / (24 * H)}d`;
  if (v >= H) return `${v / H}h`;
  return `${v / M}m`;
};
const fmtPercent = (v: number) => `${v}%`;

// Demo tier values follow competitor conventions; PM finalizes here in one
// place. Param names track hot-token v6 so the passthrough swap is mechanical.
export const MARKET_FILTER_FIELD_CONFIGS: IMarketFilterFieldConfig[] = [
  {
    field: EMarketFilterField.TokenAgeMax,
    label: 'Token Age',
    direction: 'lte',
    tiers: [5 * M, 30 * M, H, 6 * H, 24 * H, 48 * H].map((value) => ({
      value,
      label: `≤ ${fmtAge(value)}`,
    })),
    localField: 'firstTradeTime',
    formatValue: (v) => `≤ ${fmtAge(v)}`,
  },
  {
    field: EMarketFilterField.MarketCapMin,
    label: 'Market cap',
    direction: 'gte',
    tiers: [100_000, 1_000_000, 10_000_000, 100_000_000].map((value) => ({
      value,
      label: `≥ ${fmtUsd(value)}`,
    })),
    localField: 'marketCap',
    formatValue: (v) => `≥ ${fmtUsd(v)}`,
  },
  {
    field: EMarketFilterField.LiquidityMin,
    label: 'Liquidity',
    direction: 'gte',
    tiers: [5000, 50_000, 500_000, 5_000_000].map((value) => ({
      value,
      label: `≥ ${fmtUsd(value)}`,
    })),
    localField: 'liquidity',
    formatValue: (v) => `≥ ${fmtUsd(v)}`,
  },
  {
    field: EMarketFilterField.TurnoverMin,
    label: 'Turnover',
    direction: 'gte',
    tiers: [10_000, 100_000, 1_000_000, 10_000_000].map((value) => ({
      value,
      label: `≥ ${fmtUsd(value)}`,
    })),
    localField: 'turnover',
    formatValue: (v) => `≥ ${fmtUsd(v)}`,
  },
  {
    field: EMarketFilterField.HoldersMin,
    label: 'Holders',
    direction: 'gte',
    tiers: [100, 1000, 10_000, 100_000].map((value) => ({
      value,
      label: `≥ ${fmtCount(value)}`,
    })),
    localField: 'holders',
    formatValue: (v) => `≥ ${fmtCount(v)}`,
  },
  {
    field: EMarketFilterField.ChangePercentMin,
    label: 'Change',
    direction: 'gte',
    tiers: [5, 10, 50, 100].map((value) => ({
      value,
      label: `≥ ${fmtPercent(value)}`,
    })),
    localField: 'change24h',
    formatValue: (v) => `≥ ${fmtPercent(v)}`,
  },
  {
    field: EMarketFilterField.TxnsMin,
    label: 'Txns',
    direction: 'gte',
    tiers: [100, 1000, 10_000, 50_000].map((value) => ({
      value,
      label: `≥ ${fmtCount(value)}`,
    })),
    localField: 'transactions',
    formatValue: (v) => `≥ ${fmtCount(v)}`,
  },
  {
    field: EMarketFilterField.TradersMin,
    label: 'Traders',
    direction: 'gte',
    tiers: [100, 1000, 10_000, 50_000].map((value) => ({
      value,
      label: `≥ ${fmtCount(value)}`,
    })),
    localField: 'uniqueTraders',
    formatValue: (v) => `≥ ${fmtCount(v)}`,
  },
  {
    field: EMarketFilterField.InflowUsdMin,
    label: 'Net inflow',
    direction: 'gte',
    tiers: [1000, 10_000, 100_000, 1_000_000].map((value) => ({
      value,
      label: `≥ ${fmtUsd(value)}`,
    })),
    // No local data source in the list response today; local demo skips it.
    localField: undefined,
    formatValue: (v) => `≥ ${fmtUsd(v)}`,
  },
];

export const MARKET_FILTER_FIELD_CONFIG_MAP = new Map(
  MARKET_FILTER_FIELD_CONFIGS.map((config) => [config.field, config]),
);

export const MARKET_FILTER_PRESETS: IMarketFilterPreset[] = [
  {
    // rankBy-passthrough view (P2-2 scope). Demo simulates locally by
    // turnover sort; PM decides keep/drop at handoff.
    id: 'topTurnover',
    label: 'Top turnover',
    conditions: {},
  },
  {
    id: 'earlyTokens',
    label: 'Early tokens',
    conditions: {
      [EMarketFilterField.TokenAgeMax]: 48 * H,
      [EMarketFilterField.LiquidityMin]: 5000,
      [EMarketFilterField.MarketCapMin]: 100_000,
    },
  },
  {
    id: 'largeCap',
    label: 'Large-cap tokens',
    conditions: {
      [EMarketFilterField.MarketCapMin]: 100_000_000,
    },
  },
];
