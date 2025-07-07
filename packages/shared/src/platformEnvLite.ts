export type IPlatformEnvLite = {
  isJest: boolean;
  isDev: boolean;
  isProduction: boolean;
  isWeb: boolean;
  isWebEmbed: boolean;
  isDesktop: boolean;
  isExtension: boolean;
  isNative: boolean;
  isExtChrome: boolean;
  isExtFirefox: boolean;
  isExtEdge: boolean;
  isE2E: boolean;
  isExtensionOffscreen: boolean;
  isRuntimeBrowser: boolean;
};

const {
  isJest,
  isDev,
  isProduction,
  isWeb,
  isWebEmbed,
  isDesktop,
  isExtension,
  isNative,
  isExtChrome,
  isExtFirefox,
  isExtEdge,
  isE2E,
  isRuntimeBrowser,
  isExtensionOffscreen,
}: {
  isJest: boolean;
  isDev: boolean;
  isProduction: boolean;
  isWeb: boolean;
  isWebEmbed: boolean;
  isDesktop: boolean;
  isExtension: boolean;
  isNative: boolean;
  isExtChrome: boolean;
  isExtFirefox: boolean;
  isExtEdge: boolean;
  isE2E: boolean;
  isRuntimeBrowser: boolean;
  isExtensionOffscreen: boolean;
} = require('./buildTimeEnv.js');

const platformEnvLite: IPlatformEnvLite = {
  isJest,
  isDev,
  isProduction,
  isWeb,
  isWebEmbed,
  isDesktop,
  isExtension,
  isNative,
  isExtChrome,
  isExtFirefox,
  isExtEdge,
  isE2E,
  isExtensionOffscreen,
  isRuntimeBrowser,
};

export default platformEnvLite;
