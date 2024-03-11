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

export const HARDWARE_SDK_VERSION = '0.3.36';

export const HARDWARE_BRIDGE_DOWNLOAD_URL =
  'https://onekey.so/download/?client=bridge';

export const CERTIFICATE_URL = 'https://certificate.onekey.so/verify';
export const CERTIFICATE_URL_PATH = '/verify';
export const CERTIFICATE_URL_LOCAL_DEV_PROXY = 'https://certificate.onekey.so';
export const HELP_CENTER_URL = 'https://help.onekey.so/hc';
export const LITE_CARD_URL = 'https://lite.onekey.so/';
export const BRIDGE_STATUS_URL = 'http://127.0.0.1:21320/status/';
export const DOWNLOAD_URL = 'https://onekey.so/download';
