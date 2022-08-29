/* eslint-disable prefer-const */
import platformEnv from '@onekeyhq/shared/src/platformEnv';

let refreshDataDebounce = 300;
let resetDataAfterCloseDelay = 200;
let refreshDataAfterOpenDelay = 300;
let visibleAfterOpenDelay = 200;
let switchAccountDelay = 500;
let preRefreshBeforeOpen = false;

if (platformEnv.isNativeIOS || platformEnv.isExtension) {
  resetDataAfterCloseDelay = 0;
  refreshDataAfterOpenDelay = 0;
  visibleAfterOpenDelay = 0;
  switchAccountDelay = 0;
  preRefreshBeforeOpen = true;
}

export const ACCOUNT_SELECTOR_REFRESH_DEBOUNCE = refreshDataDebounce;
export const ACCOUNT_SELECTOR_IS_CLOSE_RESET_DELAY = resetDataAfterCloseDelay;
export const ACCOUNT_SELECTOR_IS_OPEN_REFRESH_DELAY = refreshDataAfterOpenDelay;
export const ACCOUNT_SELECTOR_IS_OPEN_VISIBLE_DELAY =
  refreshDataAfterOpenDelay + refreshDataDebounce + visibleAfterOpenDelay;
export const ACCOUNT_SELECTOR_CHANGE_ACCOUNT_CLOSE_DRAWER_DELAY =
  switchAccountDelay;
export const ACCOUNT_SELECTOR_PRE_FRESH_BEFORE_OPEN = preRefreshBeforeOpen;
// avoid empty view render multiple times
export const ACCOUNT_SELECTOR_EMPTY_VIEW_SELECTED_WALLET_DEBOUNCED = 0;
export const ACCOUNT_SELECTOR_EMPTY_VIEW_SHOW_DELAY = 200;
