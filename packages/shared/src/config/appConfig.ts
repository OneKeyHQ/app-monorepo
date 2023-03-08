/* eslint-disable @typescript-eslint/no-non-null-assertion */
export const MAX_PAGE_CONTAINER_WIDTH = 1024;

/**
 * Tokens will injected at build process. These are client token.
 */
export const COVALENT_API_KEY = process.env.COVALENT_KEY!;
export const MOONPAY_API_KEY = process.env.MOONPAY_KEY!;

e xport const JPUSH_KEY = process.env.JPUSH_KEY!;

export const HARDWARE_SDK_IFRAME_SRC =
  process.env.HARDWARE_SDK_CONNECT_SRC || 'https://jssdk.onekey.so/0.2.36/';

export const HARDWARE_BRIDGE_DOWNLOAD_URL =
  'https://onekey.so/download/?client=bridge';

export const CERTIFICATE_URL = 'https://certificate.onekey.so/verify';
