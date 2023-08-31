import platformEnv from '../platformEnv';

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
        'http://192.168.31.215:3008',
        'http://192.168.31.204:3008',
        'http://192.168.31.205:3008',
        'http://192.168.31.96:3008',
        'http://192.168.50.36:3008',
        'http://192.168.124.2:3008',
        'http://192.168.0.104:3008',
      ]
    : []),
].filter(Boolean);

export const PROVIDER_API_PRIVATE_WHITE_LIST_ORIGIN = [
  'https://onekey.so',
  ...WEB_EMBED_API_WHITE_LIST_ORIGIN,
].filter(Boolean);

export const PROVIDER_API_PRIVATE_WHITE_LIST_METHOD = [
  'wallet_connectToWalletConnect',
  'wallet_getConnectWalletInfo',
  'wallet_sendSiteMetadata',
  'wallet_scanQrcode',
];

// white list method which can be called from any origin
//      so these method should NOT return sensitive data
export function isProviderApiPrivateAllowedMethod(method?: string) {
  return (
    method && PROVIDER_API_PRIVATE_WHITE_LIST_METHOD.includes(method || '')
  );
}

export function isProviderApiPrivateAllowedOrigin(origin?: string) {
  return (
    origin &&
    (origin?.endsWith('.onekey.so') ||
      PROVIDER_API_PRIVATE_WHITE_LIST_ORIGIN.includes(origin))
  );
}

export function isWebEmbedApiAllowedOrigin(origin?: string) {
  return origin && WEB_EMBED_API_WHITE_LIST_ORIGIN.includes(origin);
}
