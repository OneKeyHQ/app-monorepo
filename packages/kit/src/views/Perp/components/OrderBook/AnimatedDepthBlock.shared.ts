import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';

export const ORDER_BOOK_DEPTH_WIDTH_TRANSITION_MS = 260;
export const ORDER_BOOK_SIDE_RATIO_TRANSITION_MS = 300;

// Matches the original Easing.out(Easing.cubic) curve.
export const ORDER_BOOK_TRANSITION_EASING = 'cubic-bezier(0.33, 1, 0.68, 1)';

export type IDepthBarProps = {
  color: string;
  width: DimensionValue;
  left?: number;
  right?: number;
  height?: number;
  origin?: 'left' | 'right';
};

export type ISideRatioSegmentsProps = {
  bidPercentage: number;
  askPercentage: number;
  longColor: string;
  shortColor: string;
  segmentStyle: StyleProp<ViewStyle>;
  startSegmentStyle: StyleProp<ViewStyle>;
  endSegmentStyle: StyleProp<ViewStyle>;
};

export function normalizeDepthWidth(width: DimensionValue): number {
  let numericWidth = 0;
  if (typeof width === 'number') {
    numericWidth = width;
  } else if (typeof width === 'string') {
    numericWidth = Number.parseFloat(width);
  }
  if (!Number.isFinite(numericWidth)) return 0;
  return Math.max(0, Math.min(100, numericWidth));
}
