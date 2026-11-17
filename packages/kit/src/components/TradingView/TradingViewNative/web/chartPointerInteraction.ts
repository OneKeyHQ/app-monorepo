import { TRADING_VIEW_NATIVE_SUB_INDICATOR_LEGEND_TAP_MAX_DISTANCE } from '../chartConstants';
import { getTradingViewNativeTimeAxisZoomScaleAfterDrag } from '../utils/timeAxisScale';

export type ITradingViewNativePointerDragIntent = 'pan' | 'pendingLegendTap';
export type ITradingViewNativeTimeAxisPointerDragUpdate =
  | { type: 'cancel' }
  | { type: 'pending' }
  | { type: 'scale'; zoomScale: number };

const TIME_AXIS_DRAG_ACTIVATION_DISTANCE_X = 4;
const TIME_AXIS_DRAG_FAILURE_DISTANCE_Y = 12;

export function shouldStartTradingViewNativeViewportPointerDrag({
  button,
  hasActiveDrag,
}: {
  button: number;
  hasActiveDrag: boolean;
}) {
  return button === 0 && !hasActiveDrag;
}

export function getTradingViewNativePointerDragIntent({
  clientX,
  clientY,
  hasSubIndicatorSettingsTarget,
  startClientX,
  startClientY,
}: {
  clientX: number;
  clientY: number;
  hasSubIndicatorSettingsTarget: boolean;
  startClientX: number;
  startClientY: number;
}): ITradingViewNativePointerDragIntent {
  return hasSubIndicatorSettingsTarget &&
    Math.hypot(clientX - startClientX, clientY - startClientY) <=
      TRADING_VIEW_NATIVE_SUB_INDICATOR_LEGEND_TAP_MAX_DISTANCE
    ? 'pendingLegendTap'
    : 'pan';
}

export function getTradingViewNativeTimeAxisPointerDragUpdate({
  chartWidth,
  currentX,
  currentY,
  isActive,
  startX,
  startY,
  startZoomScale,
}: {
  chartWidth: number;
  currentX: number;
  currentY: number;
  isActive: boolean;
  startX: number;
  startY: number;
  startZoomScale: number;
}): ITradingViewNativeTimeAxisPointerDragUpdate {
  if (
    !isActive &&
    Math.abs(currentY - startY) > TIME_AXIS_DRAG_FAILURE_DISTANCE_Y
  ) {
    return { type: 'cancel' };
  }
  if (
    !isActive &&
    Math.abs(currentX - startX) <= TIME_AXIS_DRAG_ACTIVATION_DISTANCE_X
  ) {
    return { type: 'pending' };
  }

  return {
    type: 'scale',
    zoomScale: getTradingViewNativeTimeAxisZoomScaleAfterDrag({
      chartWidth,
      currentX,
      startX,
      startZoomScale,
    }),
  };
}
