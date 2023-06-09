/* eslint-disable @typescript-eslint/no-non-null-assertion */
export const MAX_PAGE_CONTAINER_WIDTH = 1024;

/**
 * Tokens will injected at build process. These are client token.
 */
export const COVALENT_API_KEY = process.env.COVALENT_KEY!;

export const JPUSH_KEY = process.env.JPUSH_KEY!;

export const SHORT_ONEKEYSO_URL = 'onekey.so';
export const SHORT_ONEKEYCN_URL = 'onekeycn.com';

export const HARDWARE_SDK_IFRAME_SRC_ONEKEYSO =
  process.env.HARDWARE_SDK_CONNECT_SRC || 'https://jssdk.onekey.so';

export const HARDWARE_SDK_IFRAME_SRC_ONEKEYCN =
  process.env.HARDWARE_SDK_CONNECT_SRC_ONEKEYCN || 'https://jssdk.onekeycn.com';

export const HARDWARE_SDK_VERSION = '0.3.11';

export const HARDWARE_BRIDGE_DOWNLOAD_URL =
  'https://onekey.so/download/?client=bridge';

export const CERTIFICATE_URL = 'https://certificate.onekey.so/verify';
