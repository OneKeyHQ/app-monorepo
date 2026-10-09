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

const DESKTOP_API_ALLOWED_METHODS_BY_MODULE: Readonly<
  Partial<
    Record<(typeof DESKTOP_API_ALLOWED_MODULES)[number], readonly string[]>
  >
> = Object.freeze({
  firmwareArtifact: Object.freeze([
    'getCapabilities',
    'download',
    'cancelDownloads',
    'materialize',
    'open',
    'read',
    'close',
    'createLease',
    'retain',
    'releaseLease',
    'sweepOrphans',
  ]),
});

const DESKTOP_API_DISALLOWED_METHODS = new Set([
  'constructor',
  'toString',
  'valueOf',
  'hasOwnProperty',
]);

export const isDesktopApiModuleAllowed = (module: string): boolean =>
  DESKTOP_API_ALLOWED_MODULES.includes(
    module as (typeof DESKTOP_API_ALLOWED_MODULES)[number],
  );

export const isDesktopApiMethodAllowed = (
  module: string,
  method: unknown,
): boolean => {
  if (
    typeof method !== 'string' ||
    method.startsWith('_') ||
    DESKTOP_API_DISALLOWED_METHODS.has(method)
  ) {
    return false;
  }
  const allowedMethods =
    DESKTOP_API_ALLOWED_METHODS_BY_MODULE[
      module as (typeof DESKTOP_API_ALLOWED_MODULES)[number]
    ];
  return allowedMethods ? allowedMethods.includes(method) : true;
};
