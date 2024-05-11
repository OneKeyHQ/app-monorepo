/* eslint-disable @typescript-eslint/no-non-null-assertion */

/**
 * Tokens will injected at build process. These are client token.
 */
export const COVALENT_API_KEY = process.env.COVALENT_KEY!;

export const JPUSH_KEY = process.env.JPUSH_KEY!;

export const HARDWARE_SDK_IFRAME_SRC_ONEKEYSO =
  process.env.HARDWARE_SDK_CONNECT_SRC || 'https://jssdk.onekey.so';

export const HARDWARE_SDK_IFRAME_SRC_ONEKEYCN =
  process.env.HARDWARE_SDK_CONNECT_SRC_ONEKEYCN || 'https://jssdk.onekeycn.com';

export const HARDWARE_SDK_VERSION = '1.0.0-alpha.7'; // 0.3.43     1.0.0-alpha.2

export const HARDWARE_BRIDGE_DOWNLOAD_URL =
  'https://onekey.so/download/?client=bridge';

export const CERTIFICATE_URL = 'https://certificate.onekey.so/verify';
export const CERTIFICATE_URL_PATH = '/verify';
export const CERTIFICATE_URL_LOCAL_DEV_PROXY = 'https://certificate.onekey.so';
export const HELP_CENTER_URL = 'https://help.onekey.so/hc';
export const LITE_CARD_URL = 'https://lite.onekey.so/';
export const BRIDGE_STATUS_URL = 'http://127.0.0.1:21320/status/';
export const DOWNLOAD_URL = 'https://onekey.so/download';
export const DISCORD_URL = 'https://www.discord.gg/onekey';
export const TWITTER_URL = 'https://www.twitter.com/onekeyhq';
export const GITHUB_URL = 'https://github.com/OneKeyHQ';
export const ONEKEY_URL = 'https://onekey.so';
export const ONEKEY_APP_UPDATE_URL = 'https://data.onekey.so/config.json';
export const ONEKEY_APP_TEST_UPDATE_URL =
  'https://data.onekey.so/pre-config.json';
export const ONEKY_API_URL = 'https://rest.onekeytest.com';
export const ONEKY_TEST_API_URL = 'https://rest.onekeytest.com';
// https://1key.so
export const WEB_APP_URL = 'https://wallet.onekeytest.com';
export const WEB_APP_URL_DEV = 'https://wallet.onekeytest.com';

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
  'https://onekey.so/zh_CN/products/onekey-keytag/';

export const BIP39_DOT_MAP_URL = 'https://github.com/OneKeyHQ/bip39-dotmap';
