import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketStockAnalystRatings } from '@onekeyhq/shared/types/marketV2';

/**
 * The dial follows the analyst gauge in the Figma reference (node 26190:22905):
 * a half circle running from Strong sell on the left (180deg) to Strong buy on
 * the right (0deg), split into five equal 36deg zones. The order also drives
 * the 0-4 score scale, so it must stay lowest-to-highest.
 */
export const STOCK_ANALYST_GAUGE_ZONE_LABEL_IDS = [
  ETranslations.market_stock_rating_strong_sell,
  ETranslations.global_sell,
  ETranslations.market_stock_rating_neutral,
  ETranslations.global_buy,
  ETranslations.market_stock_rating_strong_buy,
] as const;

export const STOCK_ANALYST_GAUGE_START_ANGLE = 180;
export const STOCK_ANALYST_GAUGE_END_ANGLE = 0;

// Strong sell scores 0 and Strong buy scores 4, so a weighted average of the
// five buckets addresses every point of the dial.
const STOCK_ANALYST_GAUGE_MAX_SCORE =
  STOCK_ANALYST_GAUGE_ZONE_LABEL_IDS.length - 1;

/**
 * Raw per-bucket rating counts as the provider passes them through: string
 * numbers on the untyped `underlyingMeta` payload.
 */
export interface IStockAnalystRatingCountsSource {
  analystRatingsStrongBuy?: string;
  analystRatingsBuy?: string;
  analystRatingsHold?: string;
  analystRatingsSell?: string;
  analystRatingsStrongSell?: string;
}

export interface IStockAnalystRatingCounts {
  strongSell: number;
  sell: number;
  hold: number;
  buy: number;
  strongBuy: number;
  total: number;
}

function toRatingCount(value?: string): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function toRatingPercent(value?: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function parseStockAnalystRatingCounts(
  source?: IStockAnalystRatingCountsSource,
): IStockAnalystRatingCounts {
  const strongSell = toRatingCount(source?.analystRatingsStrongSell);
  const sell = toRatingCount(source?.analystRatingsSell);
  const hold = toRatingCount(source?.analystRatingsHold);
  const buy = toRatingCount(source?.analystRatingsBuy);
  const strongBuy = toRatingCount(source?.analystRatingsStrongBuy);
  return {
    strongSell,
    sell,
    hold,
    buy,
    strongBuy,
    total: strongSell + sell + hold + buy + strongBuy,
  };
}

/**
 * Weighted consensus score on a 0 (Strong sell) to 4 (Strong buy) scale.
 * Returns undefined when neither the per-bucket counts nor the normalized
 * percentages carry usable data, which leaves the dial in its empty state.
 */
export function getStockAnalystGaugeScore(params: {
  counts?: IStockAnalystRatingCounts;
  ratings?: IMarketStockAnalystRatings;
}): number | undefined {
  const { counts, ratings } = params;
  if (counts && counts.total > 0) {
    const weighted =
      counts.sell * 1 + counts.hold * 2 + counts.buy * 3 + counts.strongBuy * 4;
    return weighted / counts.total;
  }
  // Without the five buckets only the three normalized percentages remain, so
  // they map onto the Sell / Neutral / Buy zone centers (1 / 2 / 3).
  const sell = toRatingPercent(ratings?.sell);
  const hold = toRatingPercent(ratings?.hold);
  const buy = toRatingPercent(ratings?.buy);
  const total = sell + hold + buy;
  if (total <= 0) {
    return undefined;
  }
  return (sell * 1 + hold * 2 + buy * 3) / total;
}

export function getStockAnalystGaugeAngle(score: number): number {
  if (!Number.isFinite(score)) {
    return STOCK_ANALYST_GAUGE_START_ANGLE;
  }
  const clamped = Math.min(Math.max(score, 0), STOCK_ANALYST_GAUGE_MAX_SCORE);
  return (
    STOCK_ANALYST_GAUGE_START_ANGLE *
    (1 - clamped / STOCK_ANALYST_GAUGE_MAX_SCORE)
  );
}

/**
 * Index of the zone the needle sits in, so the matching zone label can be
 * highlighted. The zones are the equal angular bands drawn on the dial, which
 * keeps the highlighted label and the needle position in sync.
 */
export function getStockAnalystGaugeZoneIndex(score: number): number {
  const zoneCount = STOCK_ANALYST_GAUGE_ZONE_LABEL_IDS.length;
  if (!Number.isFinite(score)) {
    return 0;
  }
  const clamped = Math.min(Math.max(score, 0), STOCK_ANALYST_GAUGE_MAX_SCORE);
  const zoneSize = STOCK_ANALYST_GAUGE_MAX_SCORE / zoneCount;
  return Math.min(zoneCount - 1, Math.floor(clamped / zoneSize));
}

export function polarToCartesian(params: {
  cx: number;
  cy: number;
  radius: number;
  angle: number;
}): { x: number; y: number } {
  const { cx, cy, radius, angle } = params;
  const radians = (angle * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy - radius * Math.sin(radians),
  };
}

/**
 * SVG path for a dial band. Angles decrease clockwise on screen (180deg is the
 * left end of the half circle, 0deg the right one), so the sweep flag is 1
 * whenever the arc runs from a larger angle to a smaller one.
 */
export function describeStockAnalystGaugeArc(params: {
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;
  endAngle: number;
}): string {
  const { cx, cy, radius, startAngle, endAngle } = params;
  const sweep = Math.abs(startAngle - endAngle);
  if (sweep < 0.01 || radius <= 0) {
    return '';
  }
  const start = polarToCartesian({ cx, cy, radius, angle: startAngle });
  const end = polarToCartesian({ cx, cy, radius, angle: endAngle });
  const largeArcFlag = sweep > 180 ? 1 : 0;
  const sweepFlag = startAngle > endAngle ? 1 : 0;
  return `M ${roundCoordinate(start.x)} ${roundCoordinate(
    start.y,
  )} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${roundCoordinate(
    end.x,
  )} ${roundCoordinate(end.y)}`;
}
