import { PixelRatio } from 'react-native';

export const MIN_SIDEBAR_WIDTH = 72;

export const DESKTOP_MODE_UI_PAGE_MARGIN = 0;

// The desktop page's border against the app frame: one device pixel on
// high-density screens, a step darker so it keeps the weight of the 1px line
// used elsewhere.
const HIGH_DENSITY_SCREEN = PixelRatio.get() >= 2;

export const DESKTOP_MODE_UI_PAGE_BORDER_WIDTH = HIGH_DENSITY_SCREEN ? 0.5 : 1;

export const DESKTOP_MODE_UI_PAGE_BORDER_COLOR = HIGH_DENSITY_SCREEN
  ? '$neutral5'
  : '$neutral3';

export const DESKTOP_MODE_UI_HEADER_HEIGHT = 52;

export const WINDOWS_OVERLAY_BUTTONS_WIDTH =
  'max(154px, calc(100vw - env(titlebar-area-width, 100vw) - env(titlebar-area-x, 0px) + 16px))';
