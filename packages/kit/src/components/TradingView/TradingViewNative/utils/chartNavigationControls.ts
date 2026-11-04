import { ETranslations } from '@onekeyhq/shared/src/locale';

import { TRADING_VIEW_NATIVE_NAVIGATION_PRIMARY_ACTIONS } from './chartNavigation';

import type { ITradingViewNativeNavigationAction } from './chartNavigation';

export const TRADING_VIEW_NATIVE_NAVIGATION_TOUCH_BUTTON_SIZE = 28;
export const TRADING_VIEW_NATIVE_NAVIGATION_TOUCH_BUTTON_GAP = 6;

/**
 * The primary buttons stay centered and the conditional reset button hangs off
 * their right edge, so showing it never shifts a button under the finger.
 */
export function getTradingViewNativeNavigationResetButtonLeft({
  buttonSize,
  chartWidth,
  gap,
}: {
  buttonSize: number;
  chartWidth: number;
  gap: number;
}) {
  const primaryCount = TRADING_VIEW_NATIVE_NAVIGATION_PRIMARY_ACTIONS.length;
  const primaryWidth = primaryCount * buttonSize + (primaryCount - 1) * gap;
  return (chartWidth + primaryWidth) / 2 + gap;
}

// Glyphs share a 24 px grid with thin rounded strokes.
export const TRADING_VIEW_NATIVE_NAVIGATION_BUTTONS: Record<
  ITradingViewNativeNavigationAction,
  { labelId: ETranslations; path: string }
> = {
  zoomOut: { labelId: ETranslations.menu_zoom_out, path: 'M6 12h12' },
  zoomIn: { labelId: ETranslations.menu_zoom_in, path: 'M6 12h12M12 6v12' },
  scrollLeft: {
    labelId: ETranslations.chart_scroll_left__action,
    path: 'M14 7l-5 5 5 5',
  },
  scrollRight: {
    labelId: ETranslations.chart_scroll_right__action,
    path: 'M10 7l5 5-5 5',
  },
  reset: {
    labelId: ETranslations.global_reset,
    path: 'M5.5 12a6.5 6.5 0 1 0 6.5-6.5 7.04 7.04 0 0 0-4.87 1.98L5.5 9.11M5.5 5.5v3.61h3.61',
  },
};
