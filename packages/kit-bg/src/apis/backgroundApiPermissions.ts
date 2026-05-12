import { INTERNAL_METHOD_PREFIX } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { TRADING_VIEW_LOCALHOST_ORIGIN } from '@onekeyhq/shared/src/config/appConfig';
import { KEYLESS_WEB_TAB_WHITE_LIST_ORIGIN } from '@onekeyhq/shared/src/keylessWallet/keylessWebTabUrlPatternsConstants';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

export const WEB_EMBED_API_WHITE_LIST_ORIGIN = [
  // iOS/Android origin in PRD for web-embed (local storage file).
  //    url like file:///.../index.html
  // - native:   new URL().origin return    "null"
  // - web:      new URL().origin return    "file://"
  'null',
  'file://',

  ...(platformEnv.isDev
    ? [
        // iOS simulator DEV localhost for web-embed (localhost)
        'http://localhost:3008',
        'http://localhost:8081',

        // real iOS Device web-embed origin allowed in DEV (LAN ip)
        'http://192.168.6.37:3008',
        'http://192.168.6.37',
        'http://192.168.31.215:3008',
        'http://192.168.31.204:3008',
        'http://192.168.31.205:3008',
        'http://192.168.31.96:3008',
        'http://192.168.50.36:3008',
        'http://192.168.124.2:3008',
        'http://192.168.0.104:3008',
        'http://10.44.35.136:3008',
      ]
    : []),
].filter(Boolean);

export const PROVIDER_API_PRIVATE_WHITE_LIST_ORIGIN = [
  'https://1key.so',
  'https://onekey.so',
  'https://onekeytest.com',
  ...(platformEnv.isDev ? [TRADING_VIEW_LOCALHOST_ORIGIN] : []),
  ...KEYLESS_WEB_TAB_WHITE_LIST_ORIGIN,
  ...WEB_EMBED_API_WHITE_LIST_ORIGIN,
].filter(Boolean);

export const PROVIDER_API_PRIVATE_WHITE_LIST_METHOD = [
  'wallet_connectToWalletConnect',
  'wallet_getConnectWalletInfo',
  'wallet_sendSiteMetadata',
  'wallet_scanQrcode',
  'wallet_isShowFloatingButton',
  'wallet_saveFloatingIconSettings',
  'wallet_disableFloatingButton',
  'wallet_hideFloatingButtonOnSite',
  'wallet_detectRiskLevel',
  'wallet_lastFocusUrl',
  'wallet_closeCurrentBrowserTab',
  'wallet_addBrowserUrlToRiskWhiteList',
  'wallet_requestClipboardPermission',
];

export const PROVIDER_API_PRIVATE_KEYLESS_METHOD = [
  'wallet_keylessGetStatus',
  'wallet_keylessOpenSidePanel',
  'wallet_keylessStartLogin',
  'wallet_keylessConfirmPin',
  'wallet_keylessSelectAccount',
  'wallet_keylessDisconnectSite',
];

// white list method which can be called from any origin
//      so these method should NOT return sensitive data
export function isProviderApiPrivateAllowedMethod(method?: string) {
  return !!method && PROVIDER_API_PRIVATE_WHITE_LIST_METHOD.includes(method);
}

export function isProviderApiPrivateKeylessMethod(method?: string) {
  return method && PROVIDER_API_PRIVATE_KEYLESS_METHOD.includes(method || '');
}

// Dev servers run on arbitrary ports (e.g. http://localhost:3000), but the
// strict allow-lists only contain "http://localhost" without a port. Loosen
// to a startsWith check in dev so the keyless RPCs are reachable locally.
function isDevLocalhostOrigin(origin?: string): boolean {
  return Boolean(
    platformEnv.isDev &&
    origin &&
    (origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1')),
  );
}

export function isProviderApiPrivateAllowedKeylessOrigin(origin?: string) {
  if (!origin) return false;
  if (KEYLESS_WEB_TAB_WHITE_LIST_ORIGIN.includes(origin)) return true;
  return isDevLocalhostOrigin(origin);
}

export function isProviderApiPrivateAllowedOrigin(origin?: string) {
  return (
    origin &&
    (origin?.endsWith('.onekey.so') ||
      origin?.endsWith('.onekeytest.com') ||
      isDevLocalhostOrigin(origin) ||
      PROVIDER_API_PRIVATE_WHITE_LIST_ORIGIN.includes(origin))
  );
}

export function isWebEmbedApiAllowedOrigin(origin?: string) {
  return !!origin && WEB_EMBED_API_WHITE_LIST_ORIGIN.includes(origin);
}

export function isExtensionInternalCall(payload: IJsBridgeMessagePayload) {
  const { internal, origin } = payload;
  const request = payload.data as IJsonRpcRequest;

  const extensionUrl = chrome.runtime.getURL('');

  return (
    platformEnv.isExtension &&
    origin &&
    internal &&
    request?.method?.startsWith(INTERNAL_METHOD_PREFIX) &&
    extensionUrl.startsWith(origin)
  );
}
