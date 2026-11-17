import { clampTradingViewNativePriceRangeScale } from '../utils/priceAxisScale';

const WHEEL_AXIS_DOMINANCE_RATIO = 3;
const WHEEL_GESTURE_RESET_DELAY = 100;
const WHEEL_DELTA_NORMALIZATION_FACTOR = 100;
const WHEEL_DELTA_MODE_LINE = 1;
const WHEEL_DELTA_MODE_PAGE = 2;
const WHEEL_DELTA_LINE_MULTIPLIER = 32;
const WHEEL_DELTA_PAGE_MULTIPLIER = 120;
const WHEEL_PAN_MULTIPLIER = 80;
const WHEEL_ZOOM_STEP = 0.1;
const WHEEL_PRICE_RANGE_SCALE_STEP = 0.1;

interface ITradingViewNativeWheelEventData {
  deltaMode: number;
  deltaX: number;
  deltaY: number;
  isMacOS: boolean;
  shiftKey: boolean;
  timeStamp: number;
}

export interface ITradingViewNativeWheelDelta {
  deltaX: number;
  deltaY: number;
}

function normalizeWheelDeltaMode({
  deltaMode,
  deltaX,
  deltaY,
}: Pick<
  ITradingViewNativeWheelEventData,
  'deltaMode' | 'deltaX' | 'deltaY'
>): ITradingViewNativeWheelDelta {
  let normalizedDeltaX = deltaX / WHEEL_DELTA_NORMALIZATION_FACTOR;
  let normalizedDeltaY = deltaY / WHEEL_DELTA_NORMALIZATION_FACTOR;

  if (deltaMode === WHEEL_DELTA_MODE_PAGE) {
    normalizedDeltaX *= WHEEL_DELTA_PAGE_MULTIPLIER;
    normalizedDeltaY *= WHEEL_DELTA_PAGE_MULTIPLIER;
  } else if (deltaMode === WHEEL_DELTA_MODE_LINE) {
    normalizedDeltaX *= WHEEL_DELTA_LINE_MULTIPLIER;
    normalizedDeltaY *= WHEEL_DELTA_LINE_MULTIPLIER;
  }

  return { deltaX: normalizedDeltaX, deltaY: normalizedDeltaY };
}

export class TradingViewNativeWheelDeltaNormalizer {
  private previousWheelTime = 0;

  private totalDeltaX = 0;

  private totalDeltaY = 0;

  processWheel({
    deltaMode,
    deltaX,
    deltaY,
    isMacOS,
    shiftKey,
    timeStamp,
  }: ITradingViewNativeWheelEventData): ITradingViewNativeWheelDelta {
    if (timeStamp - this.previousWheelTime > WHEEL_GESTURE_RESET_DELAY) {
      this.reset();
    }

    const shouldSwapWheelAxes = !isMacOS && shiftKey;
    const resolvedDeltaX = shouldSwapWheelAxes ? -deltaY : deltaX;
    const resolvedDeltaY = shouldSwapWheelAxes ? deltaX : deltaY;
    this.totalDeltaX += resolvedDeltaX;
    this.totalDeltaY += resolvedDeltaY;
    this.previousWheelTime = timeStamp;

    const delta = {
      deltaX: resolvedDeltaX,
      deltaY: resolvedDeltaY,
    };
    if (this.totalDeltaX !== 0 && this.totalDeltaY !== 0) {
      if (
        Math.abs(this.totalDeltaX) >=
        Math.abs(WHEEL_AXIS_DOMINANCE_RATIO * this.totalDeltaY)
      ) {
        delta.deltaY = 0;
      }
      if (
        Math.abs(this.totalDeltaY) >=
        Math.abs(WHEEL_AXIS_DOMINANCE_RATIO * this.totalDeltaX)
      ) {
        delta.deltaX = 0;
      }
    }

    return normalizeWheelDeltaMode({ deltaMode, ...delta });
  }

  private reset() {
    this.totalDeltaX = 0;
    this.totalDeltaY = 0;
  }
}

export function getTradingViewNativeWheelPanOffsetDelta(deltaX: number) {
  return -WHEEL_PAN_MULTIPLIER * deltaX;
}

export function getTradingViewNativeWheelZoomAnchorX({
  chartWidth,
  ctrlKey,
  cursorX,
  isMacOS,
  metaKey,
}: {
  chartWidth: number;
  ctrlKey: boolean;
  cursorX: number;
  isMacOS: boolean;
  metaKey: boolean;
}) {
  const isFocusedZoom = isMacOS ? metaKey : ctrlKey;
  return isFocusedZoom ? cursorX : chartWidth;
}

export function getTradingViewNativeWheelZoomScale({
  currentZoomScale,
  deltaY,
}: {
  currentZoomScale: number;
  deltaY: number;
}) {
  const zoomDelta =
    Math.sign(-deltaY) * Math.min(1, Math.abs(deltaY)) * WHEEL_ZOOM_STEP;
  return currentZoomScale * (1 + zoomDelta);
}

export function getTradingViewNativeWheelPriceRangeScale({
  currentScale,
  deltaY,
}: {
  currentScale: number;
  deltaY: number;
}) {
  const scaleDelta =
    Math.sign(deltaY) *
    Math.min(1, Math.abs(deltaY)) *
    WHEEL_PRICE_RANGE_SCALE_STEP;
  return clampTradingViewNativePriceRangeScale(currentScale * (1 + scaleDelta));
}
