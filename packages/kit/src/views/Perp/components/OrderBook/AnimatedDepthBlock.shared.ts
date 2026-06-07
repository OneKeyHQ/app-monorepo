import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';

export const ORDER_BOOK_DEPTH_WIDTH_TRANSITION_MS = 260;
export const ORDER_BOOK_SIDE_RATIO_TRANSITION_MS = 300;

// Matches the original Easing.out(Easing.cubic) curve.
export const ORDER_BOOK_TRANSITION_EASING = 'cubic-bezier(0.33, 1, 0.68, 1)';

// ---- Per-layout pixel-alignment constants (single source) ----
// Both the native depth-bar view props and the RN text layer read these so the
// two layers can never drift apart. See the native depth bar design notes.
//
// Layout contract reproduced by the native view:
//   row i top = rowMarginTop + i * (rowHeight + rowMarginTop)  (margin on every
//   row incl. the first), bar rect inset vertically by barInset inside the row.

// Horizontal / compact layout: inline `height: 24` rows, no inter-row margin.
export const ORDER_BOOK_HORIZONTAL_ROW_HEIGHT = 24;
export const ORDER_BOOK_HORIZONTAL_ROW_MARGIN_TOP = 0;
export const ORDER_BOOK_HORIZONTAL_BAR_INSET = 0;

// Vertical (web/tablet) layout: `blockRow.marginTop = 1`. The row height itself
// is dynamic (`verticalRowHeight`) and supplied at runtime.
export const ORDER_BOOK_VERTICAL_ROW_MARGIN_TOP = 1;
export const ORDER_BOOK_VERTICAL_BAR_INSET = 0;

// Mobile layout: fixed 20pt rows, no inter-row margin. Bar is inset by the row
// gap (0 today — kept as a named constant so it is never hard-coded away).
export const ORDER_BOOK_MOBILE_ROW_HEIGHT = 20;
export const ORDER_BOOK_MOBILE_ROW_GAP = 0;
export const ORDER_BOOK_MOBILE_ROW_MARGIN_TOP = 0;
export const ORDER_BOOK_MOBILE_BAR_INSET = ORDER_BOOK_MOBILE_ROW_GAP;
export const ORDER_BOOK_MOBILE_SPREAD_ROW_HEIGHT = 60;

export type IDepthBarProps = {
  animated?: boolean;
  color: string;
  width: DimensionValue;
  left?: number;
  right?: number;
  height?: number;
  origin?: 'left' | 'right';
};

export type IDepthBarColumnProps = {
  animated?: boolean;
  /** Depth percentage per row, 0..100. Length === number of rows on this side. */
  percents: number[];
  /** Row height in points (matches the sibling RN text row height). */
  rowHeight: number;
  /** Inter-row gap in points; applied to every row including the first. */
  rowMarginTop: number;
  /** Vertical inset of the bar inside its row in points. */
  barInset: number;
  /** Resolved fill color (hex / rgba / rgb). */
  color: string;
  /** Fill anchor / growth direction. */
  origin?: 'left' | 'right';
  /**
   * Monotonic token. Bump on coin switch / tick-size change / empty<->full so
   * the native view snaps to the new values WITHOUT animating (see design §6).
   */
  epoch: number;

  // Optional native per-row text (price left / size right). When provided the
  // native view draws the ladder text itself — no sibling RN <Text> rows — and
  // emits `onRowPress(rowIndex)` for taps. Arrays are parallel to `percents`.
  prices?: string[];
  sizes?: string[];
  priceColor?: string;
  sizeColor?: string;
  priceFontSize?: number;
  sizeFontSize?: number;
  textInset?: number;
  onRowPress?: (rowIndex: number) => void;
  /**
   * Per-row placeholder text drawn by the column itself while it has no real
   * data (e.g. "--"). The view owns its empty state — no RN skeleton/overlay —
   * so it swaps atomically to real numbers with no blank handoff frame. Drawn in
   * `priceColor` (left) / `sizeColor` (right), no bar fill.
   */
  placeholderText?: string;
  /** Number of placeholder rows to draw while `placeholderText` is shown. */
  placeholderRows?: number;
};

export type ISideRatioSegmentsProps = {
  animated?: boolean;
  bidPercentage: number;
  askPercentage: number;
  longColor: string;
  shortColor: string;
  segmentStyle: StyleProp<ViewStyle>;
  startSegmentStyle: StyleProp<ViewStyle>;
  endSegmentStyle: StyleProp<ViewStyle>;
  /** Gap between the two segments in points (native renders it internally). */
  gap?: number;
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
