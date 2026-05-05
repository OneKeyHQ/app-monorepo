import type { IStakeEarnDetail } from '@onekeyhq/shared/types/staking';

export type IPtConvergenceChartData = NonNullable<
  NonNullable<IStakeEarnDetail['rules']>['chart']
>;

export interface IPendlePtConvergenceChartProps {
  chart: IPtConvergenceChartData;
}

export const SVG_WIDTH = 632;
export const SVG_HEIGHT = 232;

export const CHART_WIDTH = 512;

export const NOW_X = 133;
export const DOT_X = 134;
export const END_X = 488;
export const MID_X = (NOW_X + END_X) / 2;

export const TARGET_Y = 28;
export const CURRENT_REFERENCE_Y = 158;
export const BOTTOM_Y = 190;
export const LABEL_Y = 222;

export const REFERENCE_TARGET_RATE = 1;
export const REFERENCE_CURRENT_RATE = 0.9841;
const REFERENCE_RATE_GAP = REFERENCE_TARGET_RATE - REFERENCE_CURRENT_RATE;
const REFERENCE_CURVE_SPAN = CURRENT_REFERENCE_Y - TARGET_Y;
const CHART_Y_SPAN = BOTTOM_Y - TARGET_Y;
// Axis padding keeps small rate gaps readable without flattening the curve too much.
const AXIS_PADDING_GAP =
  (REFERENCE_RATE_GAP * (CHART_Y_SPAN - REFERENCE_CURVE_SPAN)) /
  REFERENCE_CURVE_SPAN;
const MAX_CURVE_SCALE = CHART_Y_SPAN / REFERENCE_CURVE_SPAN;

const BADGE_HORIZONTAL_PADDING = 12;
const AVG_CHAR_WIDTH = 6.6;

export const COLORS = {
  greenStroke: 'rgba(0,131,71,0.84)',
  fillTop: 'rgba(66,255,164,0.15)',
  fillBottom: 'rgba(66,255,164,0)',
  badge: '#4D525D',
} as const;

// Full-width wavy curve path in absolute SVG coordinates (valid at reference curveScale=1).
// The curve oscillates like a real market chart and converges to TARGET_Y at END_X.
// Key anchor: at NOW_X (133) the curve sits at CURRENT_REFERENCE_Y (158).
export const FULL_CURVE_PATH =
  'M 10 162 C 30 163 58 132 78 136 C 98 140 116 154 133 158 C 148 162 158 184 176 184 C 196 184 218 108 244 108 C 265 108 275 126 296 114 C 320 98 342 83 362 74 C 384 66 415 44 435 41 C 455 36 473 29 488 28';

// Same curve closed to the bottom for the gradient fill area.
export const FULL_FILL_PATH =
  'M 10 162 C 30 163 58 132 78 136 C 98 140 116 154 133 158 C 148 162 158 184 176 184 C 196 184 218 108 244 108 C 265 108 275 126 296 114 C 320 98 342 83 362 74 C 384 66 415 44 435 41 C 455 36 473 29 488 28 L 488 190 L 10 190 Z';

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getCurveScale({
  currentRate,
  targetRate,
}: {
  currentRate: number;
  targetRate: number;
}) {
  const gap = Math.max(targetRate - currentRate, 0);
  if (!Number.isFinite(gap) || REFERENCE_RATE_GAP <= 0) {
    return 1;
  }
  const scaledSpan = (CHART_Y_SPAN * gap) / (gap + AXIS_PADDING_GAP);
  const rawScale = scaledSpan / REFERENCE_CURVE_SPAN;
  return clamp(rawScale, 0, MAX_CURVE_SCALE);
}

export function getCurrentPointY(curveScale: number) {
  return TARGET_Y + curveScale * (CURRENT_REFERENCE_Y - TARGET_Y);
}

export function formatRate(rate: number) {
  if (!Number.isFinite(rate)) {
    return '--';
  }
  return Number(rate.toFixed(4)).toString();
}

export function fitTextToWidth(text: string, maxWidth: number) {
  const normalized = text.trim();
  if (!normalized || maxWidth <= 0) {
    return normalized;
  }
  const maxChars = Math.max(
    1,
    Math.floor((maxWidth - BADGE_HORIZONTAL_PADDING) / AVG_CHAR_WIDTH),
  );
  if (normalized.length <= maxChars) {
    return normalized;
  }
  if (maxChars === 1) {
    return '…';
  }
  return `${normalized.slice(0, maxChars - 1)}…`;
}

export function getBadgeWidth({
  text,
  minWidth,
  maxWidth,
}: {
  text: string;
  minWidth: number;
  maxWidth: number;
}) {
  const estimatedWidth =
    text.length * AVG_CHAR_WIDTH + BADGE_HORIZONTAL_PADDING;
  return clamp(estimatedWidth, minWidth, maxWidth);
}
