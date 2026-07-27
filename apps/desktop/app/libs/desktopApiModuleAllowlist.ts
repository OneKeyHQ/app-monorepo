export const DESKTOP_API_ALLOWED_MODULES = Object.freeze([
  'system',
  'security',
  'storage',
  'webview',
  'notification',
  'dev',
  'inAppPurchase',
  'bluetooth',
  'appUpdate',
  'bundleUpdate',
  'cloudKit',
  'keychain',
  'sniRequest',
  'oauthLocalServer',
  'appleAuth',
  'firmwareArtifact',
] as const);

export const isDesktopApiModuleAllowed = (module: string): boolean =>
  DESKTOP_API_ALLOWED_MODULES.includes(
    module as (typeof DESKTOP_API_ALLOWED_MODULES)[number],
  );
