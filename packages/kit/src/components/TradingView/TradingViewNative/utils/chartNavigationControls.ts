import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { ITradingViewNativeNavigationAction } from './chartNavigation';

export const TRADING_VIEW_NATIVE_NAVIGATION_TOUCH_BUTTON_SIZE = 36;
export const TRADING_VIEW_NATIVE_NAVIGATION_TOUCH_BUTTON_GAP = 8;

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
