import { TRADING_VIEW_NATIVE_SUB_INDICATOR_LEGEND_TAP_MAX_DISTANCE } from '../chartConstants';
import { getTradingViewNativeTimeAxisZoomScaleAfterDrag } from '../utils/timeAxisScale';

export type ITradingViewNativePointerDragIntent = 'pan' | 'pendingLegendTap';

const TIME_AXIS_DRAG_ACTIVATION_DISTANCE = 4;

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

export function getTradingViewNativeTimeAxisPointerZoomScale({
  chartWidth,
  currentX,
  isActive,
  startX,
  startZoomScale,
}: {
  chartWidth: number;
  currentX: number;
  isActive: boolean;
  startX: number;
  startZoomScale: number;
}) {
  if (
    !isActive &&
    Math.abs(currentX - startX) <= TIME_AXIS_DRAG_ACTIVATION_DISTANCE
  ) {
    return null;
  }

  return getTradingViewNativeTimeAxisZoomScaleAfterDrag({
    chartWidth,
    currentX,
    startX,
    startZoomScale,
  });
}
