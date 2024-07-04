/* eslint-disable @typescript-eslint/no-non-null-assertion */

import type { EServiceEndpointEnum, IEndpointEnv } from '../../types/endpoint';

export const HARDWARE_SDK_IFRAME_SRC_ONEKEYSO =
  process.env.HARDWARE_SDK_CONNECT_SRC || 'https://jssdk.onekey.so';

export const HARDWARE_SDK_VERSION = '1.0.3'; // 0.3.43     1.0.0-alpha.2

export const HARDWARE_BRIDGE_DOWNLOAD_URL =
  'https://onekey.so/download/?client=bridge';

export const FIRMWARE_UPDATE_WEB_TOOLS_URL = 'https://firmware.onekey.so';
export const FIRMWARE_CONTACT_US_URL = 'https://help.onekey.so/hc/requests/new';
export const FIRMWARE_MANUAL_ENTERING_BOOTLOADER_MODE_GUIDE =
  'https://help.onekey.so/hc/articles/8352275268623';
export const FIRMWARE_UPDATE_FULL_RES_GUIDE =
  'https://help.onekey.so/hc/articles/8884680775951';
export const FIRMWARE_UPDATE_BRIDGE_GUIDE =
  'https://help.onekey.so/hc/articles/9740566472335';

export const HELP_CENTER_URL = 'https://help.onekey.so/hc';
export const LITE_CARD_URL =
  'https://onekey.so/products/onekey-lite-hardware-wallet/';
export const BRIDGE_STATUS_URL = 'http://127.0.0.1:21320/status/';
export const DOWNLOAD_URL = 'https://onekey.so/download';
export const DOWNLOAD_MOBILE_APP_URL =
  'https://onekey.so/download?client=mobile';
export const DISCORD_URL = 'https://www.discord.gg/onekey';
export const TWITTER_URL = 'https://www.twitter.com/onekeyhq';
export const GITHUB_URL = 'https://github.com/OneKeyHQ';
export const ONEKEY_URL = 'https://onekey.so';

export const ONEKEY_API_HOST = 'onekeycn.com';
export const ONEKEY_TEST_API_HOST = 'onekeytest.com';

export const WEB_APP_URL = 'https://1key.so';
export const WEB_APP_URL_DEV = 'https://app.onekeytest.com';

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
}: {
  serviceName: EServiceEndpointEnum;
  env: IEndpointEnv;
}) =>
  `https://${serviceName}.${
    env === 'prod' ? ONEKEY_API_HOST : ONEKEY_TEST_API_HOST
  }`;
