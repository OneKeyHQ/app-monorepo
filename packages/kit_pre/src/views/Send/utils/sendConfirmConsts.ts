import type { BadgeType } from '@onekeyhq/components/src/Badge';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// firefox navigation.navigate() does not working isExtensionUiStandaloneWindow
// export const IS_REPLACE_ROUTE_TO_FEE_EDIT =
//   platformEnv.isExtFirefox && platformEnv.isExtensionUiStandaloneWindow;
export const IS_REPLACE_ROUTE_TO_FEE_EDIT = false;

export const SEND_EDIT_FEE_PRICE_UP_RATIO = 1.1;

// blocknative every 5 seconds for free tier apikeys
export const FEE_INFO_POLLING_INTERVAL = 6000;

export const FEE_LEVEL_TEXT_COLOR_MAP = [
  'decorative-icon-one',
  'text-warning',
  'decorative-icon-five',
];
export const FEE_LEVEL_BADGE_TYPE_MAP: BadgeType[] = [
  'success',
  'warning',
  'critical',
];
