/* eslint-disable @typescript-eslint/no-non-null-assertion */

import App from '@onekeyhq/desktop/App';

import type { EServiceEndpointEnum, IEndpointEnv } from '../../types/endpoint';

export const HARDWARE_SDK_IFRAME_SRC_ONEKEYSO =
  process.env.HARDWARE_SDK_CONNECT_SRC || 'https://jssdk.onekey.so';

export const HARDWARE_SDK_VERSION: string =
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  require('@onekeyfe/hd-core/package.json').version as string;

export const HARDWARE_BRIDGE_DOWNLOAD_URL =
  'https://onekey.so/download/?client=bridge';

export const FIRMWARE_UPDATE_WEB_TOOLS_URL = 'https://firmware.onekey.so';
export const FIRMWARE_CONTACT_US_URL =
  'https://help.onekey.so/articles/11536900';
export const FIRMWARE_MANUAL_ENTERING_BOOTLOADER_MODE_GUIDE =
  'https://help.onekey.so/articles/11461126';
export const FIRMWARE_UPDATE_FULL_RES_GUIDE =
  'https://help.onekey.so/articles/11461118';
export const FIRMWARE_UPDATE_BRIDGE_GUIDE =
  'https://help.onekey.so/articles/11461117';

export const HELP_CENTER_URL = 'https://help.onekey.so';
export const HELP_CENTER_COMMON_FAQ_URL =
  'https://help.onekey.so/collections/13034346';
export const LITE_CARD_URL =
  'https://onekey.so/products/onekey-lite-hardware-wallet/';
export const BRIDGE_STATUS_URL = 'http://127.0.0.1:21320/status/';
export const NOTIFICATIONS_HELP_CENTER_URL =
  'https://help.onekey.so/articles/11461187';
export const DOWNLOAD_URL = 'https://onekey.so/download';
export const DOWNLOAD_MOBILE_APP_URL =
  'https://onekey.so/download?client=mobile';
export const REFERRAL_HELP_LINK = 'https://help.onekey.so/articles/11461266';
export const COIN_CONTROL_HELP_LINK =
  'https://help.onekey.so/articles/13050014';
export const HARDWARE_TROUBLESHOOTING_URL =
  'https://help.onekey.so/articles/13183743';

export const FRESH_ADDRESS_LEARN_MORE_URL =
  'https://help.onekey.so/articles/12620219';

export const TWITTER_URL = 'https://www.twitter.com/onekeyhq';
export const TWITTER_FOLLOW_URL =
  'https://x.com/intent/follow?screen_name=OneKeyHQ';
export const TWITTER_FOLLOW_URL_CN =
  'https://x.com/intent/follow?screen_name=OneKeyCN';
export const GITHUB_URL = 'https://github.com/OneKeyHQ';
export const ONEKEY_URL = 'https://onekey.so';
export const ONEKEY_BLOCK_EXPLORER_URL = 'https://tx.onekey.so';
export const ONEKEY_BLOCK_EXPLORER_TEST_URL = 'https://tx.onekeytest.com';

export const ONEKEY_API_HOST = 'onekeycn.com';
export const ONEKEY_TEST_API_HOST = 'onekeytest.com';

// IP Table CDN Configuration
export const IP_TABLE_CDN_URL = 'https://config.onekeycn.com/data.json';
export const IP_TABLE_CDN_FETCH_TIMEOUT_MS = 5000; // 5 seconds timeout for CDN fetch

export const WEB_APP_URL = 'https://app.onekey.so';
export const WEB_APP_URL_SHORT = 'https://1key.so';
export const WEB_APP_URL_DEV = 'https://app.onekeytest.com';

export function getWebAppUrl(env: IEndpointEnv): string {
  return env === 'prod' ? 'app.onekey.so' : 'app.onekeytest.com';
}

export function buildReferralUrl({
  code,
  source,
  env = 'prod',
}: {
  code: string;
  source: 'Perps' | 'Earn';
  env?: IEndpointEnv;
}): string {
  const path = source === 'Perps' ? '/app/perps' : '/app/defi';
  const baseUrl = getWebAppUrl(env);
  return `${baseUrl}/r/${code}${path}`;
}

export const EXT_RATE_URL = {
  'chrome':
    'https://chrome.google.com/webstore/detail/onekey/jnmbobjmhlngoefaiojfljckilhhlhcj',
  'firefox': 'https://addons.mozilla.org/zh-CN/firefox/addon/onekey/reviews/',
  'edge':
    'https://microsoftedge.microsoft.com/addons/detail/onekey/obffkkagpmohennipjokmpllocnlndac',
};

export const APP_STORE_LINK = `itms-apps://apps.apple.com/app/id1609559473?action=write-review`;
export const PLAY_STORE_LINK = `market://details?id=so.onekey.app.wallet`;

export const ONEKEY_KEY_TAG_PURCHASE_URL =
  'https://onekey.so/products/onekey-keytag/';

export const BIP39_DOT_MAP_URL = 'https://github.com/OneKeyHQ/bip39-dotmap';

export const buildServiceEndpoint = ({
  serviceName,
  env,
  isWebSocket,
}: {
  serviceName: EServiceEndpointEnum;
  env: IEndpointEnv;
  isWebSocket?: boolean;
}) => {
  const baseHost = env === 'prod' ? ONEKEY_API_HOST : ONEKEY_TEST_API_HOST;
  return `${isWebSocket ? 'wss' : 'https'}://${serviceName}.${baseHost}`;
};

export const CHAIN_SELECTOR_LOGO =
  'https://uni.onekey-asset.com/static/logo/chain_selector_logo.png';
export const defaultColorScheme = 'dark';

export const TRADING_VIEW_URL = 'https://tradingview.onekey.so';
export const TRADING_VIEW_URL_TEST = 'https://tradingview.onekeytest.com';

export const FALCON_DOCS_URL = 'https://docs.falcon.finance/';
export const ONEKEY_HEALTH_CHECK_URL = '/wallet/v1/health';

export const SUPPORT_URL = 'https://help.onekey.so/hc/requests/new';

export const HYPERLIQUID_EXPLORER_URL = 'https://hypurrscan.io/address/';

export const DESKTOP_ICLOUD_CONTAINER_ID = 'iCloud.so.onekey.wallet';

export const ONEKEY_SIFU_URL = 'https://onekey.so/products/onekey-sifu';
