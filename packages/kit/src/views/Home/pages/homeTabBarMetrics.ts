import { fs, s } from '@onekeyhq/components/src/utils/scale';

// Home tab bar geometry, shared by the pager's tab bar config and the Dust
// sweep hint that points at the Spot filter button from outside the tab bar.
export const TAB_BAR_HEIGHT = fs(24) + 2 * s(6) + 2 * s(8);

// The tab bar's filter button. The inset is to its icon; with pill tabs on web
// the button itself ends at the content edge instead, under the balance row's
// round "More" button.
export const TAB_TOOLBAR_BUTTON_SIZE = s(24) + 2 * s(6) + 2;
export const TAB_TOOLBAR_CONTENT_WIDTH = s(24);
export const TAB_TOOLBAR_TRAILING_INSET = s(20);
export const TAB_TOOLBAR_FLUSH_TRAILING_INSET =
  TAB_TOOLBAR_TRAILING_INSET +
  (TAB_TOOLBAR_BUTTON_SIZE - TAB_TOOLBAR_CONTENT_WIDTH) / 2;
