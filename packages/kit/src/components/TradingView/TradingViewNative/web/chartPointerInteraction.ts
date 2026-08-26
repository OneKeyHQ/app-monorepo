import { TRADING_VIEW_NATIVE_SUB_INDICATOR_LEGEND_TAP_MAX_DISTANCE } from '../chartConstants';

export type ITradingViewNativePointerDragIntent = 'pan' | 'pendingLegendTap';

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
