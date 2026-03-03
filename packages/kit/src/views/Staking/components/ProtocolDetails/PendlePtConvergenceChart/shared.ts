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
const CURRENT_REFERENCE_Y = 158;
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

export const LEFT_LINE_PATH =
  'M125 19.5003C102.191 19.5003 80.3811 15.8293 57.5716 12.0309C38.7145 8.89059 19.8574 7.02666 1.00027 1.00027';
export const CURVE_PATH =
  'M1 1C23.8095 1 46.619 15.9143 69.4285 20.5376C92.238 25.1609 115.048 23.2716 137.857 28.7397C160.667 34.2077 183.476 69.2683 206.286 73.4492C229.095 77.63 251.904 75.5396 274.714 79.7205C297.523 83.9013 320.333 115.954 343.143 126.029C347.095 127.774 351.048 129.254 355 130.527';
export const FILL_PATH =
  'M68.2857 19.5376C45.5238 14.9143 22.7619 0 0 0V162H478V148C455.238 148 432.476 143.97 409.714 140.141C386.952 136.313 364.19 135.104 341.428 125.029C318.666 114.954 295.904 82.9013 273.142 78.7205C250.381 74.5396 227.619 76.63 204.857 72.4492C182.095 68.2683 159.333 33.2077 136.571 27.7397C113.81 22.2716 91.0475 24.1609 68.2857 19.5376Z';

export type IPathLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  viewBoxWidth: number;
  viewBoxHeight: number;
};

export const FILL_LAYOUT: IPathLayout = {
  x: 10,
  y: 28,
  width: 478,
  height: 162,
  viewBoxWidth: 478,
  viewBoxHeight: 162,
};

export const LEFT_LAYOUT: IPathLayout = {
  x: 10,
  y: 157.5,
  width: 124,
  height: 18.5,
  viewBoxWidth: 126,
  viewBoxHeight: 20.5003,
};

export const CURVE_LAYOUT: IPathLayout = {
  x: 134,
  y: 28,
  width: 354,
  height: 129.527,
  viewBoxWidth: 356,
  viewBoxHeight: 131.527,
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function buildPathTransform(layout: IPathLayout) {
  const scaleX = layout.width / layout.viewBoxWidth;
  const scaleY = layout.height / layout.viewBoxHeight;
  return `translate(${layout.x + layout.width} ${layout.y}) scale(${-scaleX} ${scaleY})`;
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
