import { MARKET_DESKTOP_CONTENT_MAX_WIDTH } from '../../marketDesktopLayoutConstants';

// Desktop stock detail runs on the same fixed content frame as every other
// desktop Market page: a 1240 column band centered in the viewport instead of a
// viewport-relative (vw) band that kept growing on wide screens. The trade
// panel is fixed, so the left column takes whatever is left of the frame:
// 1240 - 24 - 384 = 832.
export const STOCK_DETAIL_CONTENT_MAX_WIDTH = MARKET_DESKTOP_CONTENT_MAX_WIDTH;
export const STOCK_DETAIL_HORIZONTAL_GUTTER = 20;
export const STOCK_DETAIL_COLUMN_GAP = 24;
export const STOCK_DETAIL_TRADE_PANEL_WIDTH = 384;
