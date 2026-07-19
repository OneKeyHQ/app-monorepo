import {
  EMarketFilterDimension,
  EMarketFilterGroup,
} from './marketListFilterTypes';

import type {
  IMarketFilterDimensionConfig,
  IMarketFilterPreset,
  IMarketListFilterConditions,
} from './marketListFilterTypes';

const H = 60 * 60 * 1000;
const M = 60 * 1000;

// Tier design rationale (2026-07-19 UX review):
// - Floor dimensions (liquidity/turnover/holders/txns/traders/inflow) only
//   ever mean "at least X" to users, so they get min-only tiers labeled with
//   a "+" suffix — no comparison symbols to parse.
// - Market cap is a positioning dimension: users hunt a LAYER (early micro
//   caps vs established majors), so it uses named range buckets (OKX
//   screener convention) instead of a one-sided threshold.
// - Token age keeps ceiling semantics ("everything newer than X") since new
//   listings are the hunt target; copy reads "Under X" so the whole column
//   shares one direction.
// - 3-4 tiers per row for quick scanning; token age keeps 5 (launch cadence
//   is meaningful at 30m/1h/6h/24h/48h). Values stay centralized here for
//   PM tuning. Param names track hot-token v6 for the passthrough swap.
export const MARKET_FILTER_DIMENSIONS: IMarketFilterDimensionConfig[] = [
  {
    id: EMarketFilterDimension.TokenAge,
    label: 'Token age',
    group: EMarketFilterGroup.Basics,
    // No server-side age filter exists yet (PRD-confirmed); local demo only.
    localField: 'firstTradeTime',
    isAge: true,
    options: [5 * M, 30 * M, H, 6 * H, 24 * H, 48 * H].map((value) => {
      const text = value >= H ? `${value / H}h` : `${value / M}m`;
      return {
        id: `under-${text}`,
        label: `≤ ${text}`,
        chipLabel: `≤ ${text}`,
        max: value,
      };
    }),
  },
  {
    id: EMarketFilterDimension.MarketCap,
    group: EMarketFilterGroup.Metrics,
    label: 'Market cap',
    // Unit is appended to the popover row title (Binance convention) so tier
    // pills stay short enough to fit four per row; toolbar chips keep the
    // unit inside their own value text instead.
    unit: '$',
    minParam: 'marketCapMin',
    maxParam: 'marketCapMax',
    localField: 'marketCap',
    options: [
      {
        id: 'micro',
        label: '0-100K',
        chipLabel: '0-$100K',
        max: 100_000,
      },
      {
        id: 'small',
        label: '100K-1M',
        chipLabel: '$100K-1M',
        min: 100_000,
        max: 1_000_000,
      },
      {
        id: 'mid',
        label: '1M-10M',
        chipLabel: '$1M-10M',
        min: 1_000_000,
        max: 10_000_000,
      },
      {
        id: 'large',
        label: '10M+',
        chipLabel: '$10M+',
        min: 10_000_000,
      },
    ],
  },
  {
    id: EMarketFilterDimension.Liquidity,
    label: 'Liquidity',
    group: EMarketFilterGroup.Metrics,
    unit: '$',
    minParam: 'liquidityMin',
    maxParam: 'liquidityMax',
    localField: 'liquidity',
    options: [5000, 50_000, 500_000].map((value) => ({
      id: `min-${value}`,
      label: `${value >= 1_000_000 ? `${value / 1_000_000}M` : `${value / 1000}K`}+`,
      chipLabel: `$${value >= 1_000_000 ? `${value / 1_000_000}M` : `${value / 1000}K`}+`,
      min: value,
    })),
  },
  {
    id: EMarketFilterDimension.Turnover,
    label: 'Turnover',
    group: EMarketFilterGroup.Metrics,
    unit: '$',
    minParam: 'volumeMin',
    maxParam: 'volumeMax',
    localField: 'turnover',
    options: [10_000, 100_000, 1_000_000].map((value) => ({
      id: `min-${value}`,
      label: `${value >= 1_000_000 ? `${value / 1_000_000}M` : `${value / 1000}K`}+`,
      chipLabel: `$${value >= 1_000_000 ? `${value / 1_000_000}M` : `${value / 1000}K`}+`,
      min: value,
    })),
  },
  {
    id: EMarketFilterDimension.Holders,
    label: 'Holders',
    group: EMarketFilterGroup.Activity,
    minParam: 'holdersMin',
    maxParam: 'holdersMax',
    localField: 'holders',
    options: [100, 1000, 10_000].map((value) => ({
      id: `min-${value}`,
      label: `${value >= 1000 ? `${value / 1000}K` : value}+`,
      chipLabel: `${value >= 1000 ? `${value / 1000}K` : value}+`,
      min: value,
    })),
  },
  {
    id: EMarketFilterDimension.Change,
    label: 'Change',
    group: EMarketFilterGroup.Activity,
    minParam: 'priceChangePercentMin',
    maxParam: 'priceChangePercentMax',
    localField: 'change24h',
    options: [10, 50, 100].map((value) => ({
      id: `min-${value}`,
      label: `+${value}%+`,
      chipLabel: `+${value}%+`,
      min: value,
    })),
  },
  {
    id: EMarketFilterDimension.Txns,
    label: 'Txns',
    group: EMarketFilterGroup.Activity,
    minParam: 'txsMin',
    maxParam: 'txsMax',
    localField: 'transactions',
    options: [100, 1000, 10_000].map((value) => ({
      id: `min-${value}`,
      label: `${value >= 1000 ? `${value / 1000}K` : value}+`,
      chipLabel: `${value >= 1000 ? `${value / 1000}K` : value}+`,
      min: value,
    })),
  },
  // Traders (uniqueTraderMin/Max) and Net inflow (inflowUsdMin/Max) are
  // intentionally absent: the redesigned table no longer shows a Traders
  // column and inflow has no list column or local data source — filters
  // must not reference metrics the user cannot see in the table.
];

export const MARKET_FILTER_GROUP_LABELS: Record<EMarketFilterGroup, string> = {
  [EMarketFilterGroup.Basics]: 'Token basics',
  [EMarketFilterGroup.Metrics]: 'Market metrics',
  [EMarketFilterGroup.Activity]: 'Trading activity',
  [EMarketFilterGroup.Safety]: 'Safety checks',
};

// Group render order; safety-style audit conditions sit inline near the top
// (reference-design convention) instead of behind a separate tab.
export const MARKET_FILTER_GROUP_ORDER: EMarketFilterGroup[] = [
  EMarketFilterGroup.Basics,
  EMarketFilterGroup.Safety,
  EMarketFilterGroup.Metrics,
  EMarketFilterGroup.Activity,
];

export const MARKET_FILTER_DIMENSION_MAP = new Map(
  MARKET_FILTER_DIMENSIONS.map((dimension) => [dimension.id, dimension]),
);

export function getMarketFilterOption(
  dimensionId: EMarketFilterDimension,
  optionId: string | undefined,
) {
  if (!optionId) {
    return undefined;
  }
  return MARKET_FILTER_DIMENSION_MAP.get(dimensionId)?.options.find(
    (option) => option.id === optionId,
  );
}

// Expands selected options into the flat hot-token v6 param object the
// future server passthrough will send. Kept here so the passthrough swap
// stays mechanical even while the demo filters locally.
export function buildHotTokenFilterParams(
  conditions: IMarketListFilterConditions,
): Record<string, number> {
  const params: Record<string, number> = {};
  Object.entries(conditions).forEach(([dimensionId, optionId]) => {
    const dimension = MARKET_FILTER_DIMENSION_MAP.get(
      dimensionId as EMarketFilterDimension,
    );
    const option = getMarketFilterOption(
      dimensionId as EMarketFilterDimension,
      optionId,
    );
    if (!dimension || !option) {
      return;
    }
    if (dimension.minParam && option.min !== undefined) {
      params[dimension.minParam] = option.min;
    }
    if (dimension.maxParam && option.max !== undefined) {
      params[dimension.maxParam] = option.max;
    }
  });
  return params;
}

export const MARKET_FILTER_PRESETS: IMarketFilterPreset[] = [
  {
    // rankBy-passthrough view (P2-2 scope). Demo simulates locally by
    // turnover sort; PM decides keep/drop at handoff.
    id: 'topTurnover',
    label: 'Top turnover',
    icon: 'ChartColumnarOutline',
    conditions: {},
  },
  {
    id: 'earlyTokens',
    label: 'Early tokens',
    icon: 'GrowthOutline',
    conditions: {
      [EMarketFilterDimension.TokenAge]: 'under-48h',
      [EMarketFilterDimension.Liquidity]: 'min-5000',
      [EMarketFilterDimension.MarketCap]: 'small',
    },
  },
  {
    id: 'largeCap',
    label: 'Large-cap tokens',
    icon: 'GalaxyOutline',
    conditions: {
      [EMarketFilterDimension.MarketCap]: 'large',
    },
  },
];
