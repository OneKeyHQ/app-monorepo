import BigNumber from 'bignumber.js';

import {
  displayPriceToTick,
  getFullRange,
  isFullRange,
  tickToPrice,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type { IPoolTickRange } from '@onekeyhq/shared/src/utils/poolsMath';
import type { IPool, IPoolPricePoint } from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from './poolsCopy';
import { getPoolDisplayPrice, getPoolPair, getPoolPrice } from './poolsFormat';

export type IPoolRangePresetId = 'narrow' | 'balanced' | 'wide' | 'full';

export type IPoolRangePreset = {
  id: IPoolRangePresetId;
  name: string;
  /** Half the width as a share of the price shown: 0.1 is ±10%, 1 is full */
  percent: number;
};

export const DEFAULT_RANGE_PRESET_ID: IPoolRangePresetId = 'balanced';

const SIZED_IDS = ['narrow', 'balanced', 'wide'] as const;

// Days in range each preset aims for on average: about a week, a month and
// three months, for people who set a range and leave it
const PRESET_DAYS: Record<(typeof SIZED_IDS)[number], number> = {
  narrow: 7,
  balanced: 30,
  wide: 90,
};

// The widest a sized preset goes; past this, full range is the honest pick
const MAX_PERCENT = 0.9;

// Without history, doc §3.3's widths for volatile and for stable pairs
const FALLBACK_PERCENTS = {
  volatile: [0.1, 0.2, 0.5],
  stable: [0.001, 0.005, 0.01],
};

// Fewer closes say too little about how far the pair moves
const MIN_HISTORY_POINTS = 7;

function isStablePair(pool: IPool) {
  return (
    pool.token0.category === 'stablecoin' &&
    pool.token1.category === 'stablecoin'
  );
}

/**
 * How far the pair moves in a day: the root mean square of its daily log
 * returns, so a steady trend counts as movement too.
 */
export function getDailyVolatility(history: IPoolPricePoint[] = []) {
  const prices = history
    .toSorted((a, b) => a.time - b.time)
    .map((point) => Number(point.price))
    .filter((price) => Number.isFinite(price) && price > 0);
  if (prices.length < MIN_HISTORY_POINTS) {
    return undefined;
  }
  let sum = 0;
  for (let index = 1; index < prices.length; index += 1) {
    const move = Math.log(prices[index] / prices[index - 1]);
    sum += move * move;
  }
  const volatility = Math.sqrt(sum / (prices.length - 1));
  return volatility > 0 ? volatility : undefined;
}

/**
 * Days the price is expected to stay inside a range from where it is now.
 * For a random walk with daily volatility σ, leaving a band that sits a
 * below and b above (in log price) takes a × b ÷ σ² days on average; so a
 * band of ±σ√T lasts about T days. Full range never runs out; a price
 * already outside gives 0.
 */
export function getExpectedDaysInRange(
  pool: IPool,
  range: IPoolTickRange,
  volatility: number,
) {
  const tickSpacing = pool.tickSpacing ?? 60;
  if (isFullRange({ ...range, tickSpacing })) {
    return Number.POSITIVE_INFINITY;
  }
  const decimals = {
    decimals0: pool.token0.decimals,
    decimals1: pool.token1.decimals,
  };
  const price = getPoolPrice(pool).toNumber();
  const lower = tickToPrice({ tick: range.tickLower, ...decimals }).toNumber();
  const upper = tickToPrice({ tick: range.tickUpper, ...decimals }).toNumber();
  const below = Math.log(price / lower);
  const above = Math.log(upper / price);
  if (!(below > 0 && above > 0)) {
    return 0;
  }
  return (below * above) / volatility ** 2;
}

/** Expected days in range as a short figure: ~5 days, ~1 month */
export function formatExpectedStay(days: number) {
  const { stay } = POOLS_COPY;
  if (!Number.isFinite(days)) {
    return stay.always;
  }
  if (days < 1.5) {
    return stay.days(1);
  }
  if (days < 6.5) {
    return stay.days(Math.round(days));
  }
  if (days < 24.5) {
    return stay.weeks(Math.max(Math.round(days / 7), 1));
  }
  if (days < 45) {
    return stay.months(1);
  }
  if (days < 365) {
    return stay.months(Math.round(days / 30));
  }
  return stay.overAYear;
}

/**
 * Narrow, Balanced and Wide sized to the pair's daily moves, so each is
 * expected to stay in range about a week, a month and three months; then
 * full range. A width only means something against how far the pair
 * moves. Without history they fall back to fixed widths.
 */
export function getRangePresets(
  pool: IPool,
  history: IPoolPricePoint[] = [],
): IPoolRangePreset[] {
  const volatility = getDailyVolatility(history);
  // Two tick spacings is the narrowest a range can be and still hold today
  const narrowest = 1.0001 ** (2 * (pool.tickSpacing ?? 60)) - 1;
  const percents = volatility
    ? SIZED_IDS.map((id) =>
        Math.min(
          Number(
            Math.max(
              volatility * Math.sqrt(PRESET_DAYS[id]),
              narrowest,
            ).toPrecision(2),
          ),
          MAX_PERCENT,
        ),
      )
    : FALLBACK_PERCENTS[isStablePair(pool) ? 'stable' : 'volatile'];
  return [
    ...SIZED_IDS.map((id, index) => ({
      id,
      name: POOLS_COPY.rangePresetNames[id],
      percent: percents[index],
    })),
    { id: 'full', name: POOLS_COPY.fullRange, percent: 1 },
  ];
}

/** A preset's width as its card shows it */
export function formatPresetWidth(preset: IPoolRangePreset) {
  return preset.percent >= 1
    ? POOLS_COPY.fullRangeBounds
    : `±${new BigNumber(preset.percent).times(100).toFixed()}%`;
}

/**
 * The range a preset stands for: the same share below and above today's
 * price as it is shown, so ±10% reads −10% and +10% on the bounds.
 */
export function getPresetRange(pool: IPool, percent: number): IPoolTickRange {
  const tickSpacing = pool.tickSpacing ?? 60;
  if (percent >= 1) {
    return getFullRange(tickSpacing);
  }
  const { inverted } = getPoolPair(pool);
  const now = getPoolDisplayPrice(pool);
  const tickAt = (factor: number) =>
    displayPriceToTick({
      displayPrice: now.times(factor),
      inverted,
      tickSpacing,
      decimals0: pool.token0.decimals,
      decimals1: pool.token1.decimals,
    });
  const ends = [tickAt(1 - percent), tickAt(1 + percent)];
  const tickLower = Math.min(...ends);
  const tickUpper = Math.max(Math.max(...ends), tickLower + tickSpacing);
  return { tickLower, tickUpper };
}
