import { INTERNAL_METHOD_PREFIX } from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

const PRIVATE_WHITE_LIST_ORIGIN = [
  'https://onekey.so',
  'http://localhost:3008', // iOS simulator DEV localhost for web-embed
  'http://localhost:8081', // iOS simulator DEV localhost for web-embed
  'null', // Android DEV localhost for web-embed. url like file://
].filter(Boolean);

export function isPrivateAllowedOrigin(origin?: string) {
  return (
    origin &&
    (origin?.endsWith('.onekey.so') ||
      PRIVATE_WHITE_LIST_ORIGIN.includes(origin))
  );
}

export function isPrivateAllowedMethod(method?: string) {
  return (
    method &&
    [
      'wallet_connectToWalletConnect',
      'wallet_getConnectWalletInfo',
      'wallet_sendSiteMetadata',
      'wallet_scanQrcode',
      'wallet_detectRiskLevel',
      'wallet_closeCurrentBrowserTab',
    ].includes(method || '')
  );
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
