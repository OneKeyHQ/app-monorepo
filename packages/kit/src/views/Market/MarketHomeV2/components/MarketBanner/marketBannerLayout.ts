import { s } from '@onekeyhq/components/src/utils/scale';

export const MARKET_BANNER_ITEM_WIDTH = 320;
export const MARKET_BANNER_MOBILE_ITEM_WIDTH = 288;
export const MARKET_BANNER_ITEM_HEIGHT = s(180);
// Three 20pt quote rows separated by 16pt gaps; keeps sparse cards at full height.
export const MARKET_BANNER_LIST_MIN_HEIGHT = s(92);

// Desktop web lays cards without a background out in one row with a divider
// centered in each gap.
export const MARKET_BANNER_DESKTOP_WEB_ITEM_WIDTH = 272;
export const MARKET_BANNER_DESKTOP_WEB_ITEM_GAP = 36;
export const MARKET_BANNER_DESKTOP_WEB_DIVIDER_HEIGHT = 136;
// Three 20px quote rows separated by 20px gaps.
export const MARKET_BANNER_DESKTOP_WEB_LIST_MIN_HEIGHT = 100;
