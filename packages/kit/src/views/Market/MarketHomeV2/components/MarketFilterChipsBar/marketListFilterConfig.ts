import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  EMarketFilterDimension,
  EMarketFilterGroup,
} from './marketListFilterTypes';

import type {
  IMarketFilterChip,
  IMarketFilterDimensionConfig,
  IMarketFilterOption,
  IMarketListFilterConditions,
  IMarketListSortState,
} from './marketListFilterTypes';
import type { IntlShape } from 'react-intl';

const H = 60 * 60 * 1000;
const D = 24 * H;

function formatUsd(value: number) {
  if (value >= 1_000_000) {
    return `${value / 1_000_000}M`;
  }
  return `${value / 1000}K`;
}

function formatCount(value: number) {
  return value >= 1000 ? `${value / 1000}K` : `${value}`;
}

// Floor tiers ("at least X"). The popover row title carries the unit, so the
// pill stays short; the toolbar chip has no row title and repeats it.
function usdFloors(values: number[]): IMarketFilterOption[] {
  return values.map((value) => ({
    id: `min-${value}`,
    label: `${formatUsd(value)}+`,
    chipLabel: `$${formatUsd(value)}+`,
    min: value,
  }));
}

function countFloors(values: number[]): IMarketFilterOption[] {
  return values.map((value) => ({
    id: `min-${value}`,
    label: `${formatCount(value)}+`,
    chipLabel: `${formatCount(value)}+`,
    min: value,
  }));
}

// Tier values are the frozen P2-9 table (2026-07-21), calibrated against a
// single-day rankBy=15 pool snapshot: each tier had to move the view enough to
// be worth a tap, so tiers whose in-pool retention was ~90+/100 (barely a
// change) or near 0 (a dead button) were cut. Values stay centralized here
// because the PRD expects them to become server-configurable and to be
// calibrated again once P1-11 lands. Param names track hot-token v6.
//
// Row order borrows the OKX screener's split between stock metrics and the
// ones the time frame rewrites, inverted for our trust-first positioning:
// the "is this substantial?" levers (market cap / liquidity / holders) lead,
// then the time-frame-driven metrics (turnover / change / txns), then token
// age, which serves the secondary new-launch hunt.
export const MARKET_FILTER_DIMENSIONS: IMarketFilterDimensionConfig[] = [
  {
    id: EMarketFilterDimension.MarketCap,
    group: EMarketFilterGroup.Metrics,
    labelKey: ETranslations.dexmarket_market_cap,
    unit: '$',
    minParam: 'marketCapMin',
    maxParam: 'marketCapMax',
    localField: 'marketCap',
    // 88/82/55/~30 retention; 100K cut as redundant (93 = view barely moves).
    options: usdFloors([500_000, 1_000_000, 10_000_000, 100_000_000]),
  },
  {
    id: EMarketFilterDimension.Liquidity,
    labelKey: ETranslations.dexmarket_liquidity,
    group: EMarketFilterGroup.Metrics,
    unit: '$',
    minParam: 'liquidityMin',
    maxParam: 'liquidityMax',
    localField: 'liquidity',
    // Trimmed to three so the row fits one line (matching Holders/Change/Txns).
    // 10K is the Mid-cap chip anchor, 50K the Large-cap anchor; 5M+ (~22
    // retention, rarely tapped) dropped as the least-used end of the ladder.
    options: usdFloors([10_000, 50_000, 500_000]),
  },
  {
    id: EMarketFilterDimension.Holders,
    labelKey: ETranslations.dexmarket_holders,
    group: EMarketFilterGroup.Metrics,
    minParam: 'holdersMin',
    maxParam: 'holdersMax',
    localField: 'holders',
    // 91/71/~15; the 1K floor doubles as the fake-market-cap defense.
    options: countFloors([1000, 10_000, 100_000]),
  },
  {
    id: EMarketFilterDimension.Turnover,
    labelKey: ETranslations.perp_token_selector_volume,
    group: EMarketFilterGroup.Metrics,
    unit: '$',
    minParam: 'volumeMin',
    maxParam: 'volumeMax',
    localField: 'turnover',
    // Trimmed to three (one-line row). 50K is the Mid-cap anchor, 100K the
    // Large-cap anchor; 1M+ (~4 retention, extreme) dropped. Window-sensitive:
    // the remaining tiers stop discriminating at 24h (PRD open question 8).
    options: usdFloors([10_000, 50_000, 100_000]),
  },
  {
    id: EMarketFilterDimension.Change,
    labelKey: ETranslations.dexmarket_token_change,
    group: EMarketFilterGroup.Metrics,
    minParam: 'priceChangePercentMin',
    maxParam: 'priceChangePercentMax',
    localField: 'change24h',
    // Kept deliberately: self-serve filtering is the user's call, unlike the
    // curated chips. Expect in-pool meme spikes; the copy stays honest.
    options: [10, 50, 100].map((value) => ({
      id: `min-${value}`,
      label: `${value}%+`,
      chipLabel: `${value}%+`,
      min: value,
    })),
  },
  {
    id: EMarketFilterDimension.Txns,
    labelKey: ETranslations.dexmarket_txns,
    group: EMarketFilterGroup.Metrics,
    minParam: 'txsMin',
    maxParam: 'txsMax',
    localField: 'transactions',
    // 72/~35/~10; 10K cut on quality, not reach — it returned 14 rows topped
    // by a wash-trading token's transaction count.
    options: countFloors([100, 500, 2000]),
  },
  {
    id: EMarketFilterDimension.TokenAge,
    labelKey: ETranslations.dexmarket_token_age,
    group: EMarketFilterGroup.Metrics,
    // No server-side age param exists, so this row filters the slice already
    // fetched instead of the upstream pool — the only row that does, hence the
    // separate marking in the popover.
    localField: 'firstTradeTime',
    isAge: true,
    isLocalOnly: true,
    // Finer tiers (≤5m…≤24h) are dead in every pool: tokens take ≥24h to
    // enter the hot list at all.
    options: [
      // `label`/`chipLabel` are the untranslated fallback; `age` is what the
      // renderer actually formats, through the existing token-age keys.
      {
        id: 'under-48h',
        label: '≤ 48h',
        chipLabel: '≤ 48h',
        age: { amount: 48, unit: 'h' },
        max: 2 * D,
      },
      {
        id: 'under-7d',
        label: '≤ 7d',
        chipLabel: '≤ 7d',
        age: { amount: 7, unit: 'd' },
        max: 7 * D,
      },
      {
        id: 'under-30d',
        label: '≤ 30d',
        chipLabel: '≤ 30d',
        age: { amount: 30, unit: 'd' },
        max: 30 * D,
      },
    ],
  },
  // Traders (uniqueTraderMin/Max) and Net inflow (inflowUsdMin/Max) are
  // intentionally absent: the redesigned table no longer shows a Traders
  // column and inflow has no list column or local data source — filters
  // must not reference metrics the user cannot see in the table.
];

export const MARKET_FILTER_GROUP_LABELS: Record<
  EMarketFilterGroup,
  ETranslations
> = {
  [EMarketFilterGroup.Metrics]: ETranslations.market_filters_group_metrics,
  // Names the metric these rows measure, so the rows themselves can stay
  // short enough to fit the label column ("Top 10 %", "Dev %", ...).
  // Hidden this wave, so it has no key yet — reuses the single-word Audit
  // string until the group is restored.
  [EMarketFilterGroup.Audit]: ETranslations.dexmarket_audit,
};

const TOKEN_AGE_UNIT_KEYS = {
  h: ETranslations.dexmarket_token_age_h,
  d: ETranslations.dexmarket_token_age_d,
} as const;

// Token age tiers read as "≤ 48H"; every other tier is a numeric format that
// is identical in all locales and needs no translation.
export function formatMarketFilterOptionLabel(
  intl: IntlShape,
  option: IMarketFilterOption,
  variant: 'label' | 'chipLabel' = 'label',
): string {
  if (!option.age) {
    return option[variant];
  }
  // No space after the operator: the tier pill is only wide enough for three
  // per row, and CJK units ("48小時") need every pixel.
  return `≤${intl.formatMessage(
    { id: TOKEN_AGE_UNIT_KEYS[option.age.unit] },
    { amount: option.age.amount },
  )}`;
}

// Holdings audit is out of scope for this delivery: its rows are placeholders
// pending Spike A#8 and `top10HoldPercentMax` is a confirmed dead param
// upstream. Add EMarketFilterGroup.Audit back here to restore the section —
// its labels, rows and rendering are all still in place.
export const MARKET_FILTER_GROUP_ORDER: EMarketFilterGroup[] = [
  EMarketFilterGroup.Metrics,
];

export const MARKET_FILTER_DIMENSION_MAP = new Map(
  MARKET_FILTER_DIMENSIONS.map((dimension) => [dimension.id, dimension]),
);

export function getMarketFilterOption(
  dimensionId: EMarketFilterDimension,
  optionId: string | undefined,
): IMarketFilterOption | undefined {
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

// Splits the applied conditions into the half the server can filter and the
// half it cannot. Token age has no upstream param, so it stays a client-side
// pass over the rows already fetched; everything else goes through
// buildHotTokenFilterParams and is filtered before the pool is sliced.
export function pickLocalOnlyConditions(
  conditions: IMarketListFilterConditions,
): IMarketListFilterConditions {
  const localOnly: IMarketListFilterConditions = {};
  Object.entries(conditions).forEach(([dimensionId, optionId]) => {
    const dimension = MARKET_FILTER_DIMENSION_MAP.get(
      dimensionId as EMarketFilterDimension,
    );
    if (dimension?.isLocalOnly) {
      localOnly[dimensionId as EMarketFilterDimension] = optionId;
    }
  });
  return localOnly;
}

// P2-9 chip roster (frozen 2026-07-21). Three chips; Early tokens moved to
// P2-12 because a view switch was judged too heavy for the first wave.
// Every chip anchors the time frame to 1h — the popover stays unanchored so
// self-serve filtering keeps free choice.
export const MARKET_FILTER_CHIPS: IMarketFilterChip[] = [
  {
    // Variant B: a quality floor passed upstream PLUS an in-pool turnover
    // sort. The sort half runs through the P1-10 header state machine, so the
    // chip and the column arrow are one state, and the expanded form shows
    // both halves rather than hiding the floor.
    id: 'topTurnover',
    labelKey: ETranslations.market_filter_chip_top_turnover,
    icon: 'ChartColumnarOutline',
    conditions: {
      [EMarketFilterDimension.Holders]: 'min-1000',
    },
    sort: { sortBy: 'turnover', sortType: 'desc' },
    tooltipKey: ETranslations.market_filter_chip_top_turnover_tips,
  },
  {
    id: 'midCap',
    labelKey: ETranslations.market_filter_chip_mid_cap,
    icon: 'WorldOutline',
    conditions: {
      [EMarketFilterDimension.MarketCap]: 'min-500000',
      [EMarketFilterDimension.Liquidity]: 'min-10000',
      [EMarketFilterDimension.Turnover]: 'min-50000',
    },
    tooltipKey: ETranslations.market_filter_chip_conditions_tips,
  },
  {
    // Holders floor dropped per PM 2026-07-21 (was the PRD's optional
    // quality-floor note, open question 5). Large-cap now filters on the three
    // size/liquidity/turnover floors only.
    id: 'largeCap',
    labelKey: ETranslations.market_filter_chip_large_cap,
    icon: 'GalaxyOutline',
    conditions: {
      [EMarketFilterDimension.MarketCap]: 'min-1000000',
      [EMarketFilterDimension.Liquidity]: 'min-50000',
      [EMarketFilterDimension.Turnover]: 'min-100000',
    },
    tooltipKey: ETranslations.market_filter_chip_conditions_tips,
  },
];

// Also the "did the user actually change anything" test for the Filters modal:
// applying conditions resets the sort, so an unchanged Confirm must not apply.
export function sameConditions(
  a: IMarketListFilterConditions,
  b: IMarketListFilterConditions,
) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every(
    (key) =>
      a[key as EMarketFilterDimension] === b[key as EMarketFilterDimension],
  );
}

// Chip selection is DERIVED, never stored: a chip is lit exactly when the
// live condition set (plus sort, for the sort-bearing chip) equals what that
// chip applies. So assembling the same combination by hand in the popover
// lights the chip, and nudging any tier dissolves the preset back into plain
// conditions — one truth, four presentations.
// A chip is its conditions plus its sort. The time frame is deliberately not
// part of the identity: chips carry no window of their own (2026-08-17), so
// changing the toolbar window re-runs the same preset over a different window
// and must leave the chip lit.
export function findActiveMarketFilterChip(
  conditions: IMarketListFilterConditions,
  sortState: IMarketListSortState,
): IMarketFilterChip | undefined {
  return MARKET_FILTER_CHIPS.find((chip) => {
    if (!sameConditions(chip.conditions, conditions)) {
      return false;
    }
    if (!chip.sort) {
      return true;
    }
    return (
      chip.sort.sortBy === sortState.sortBy &&
      chip.sort.sortType === sortState.sortType
    );
  });
}
