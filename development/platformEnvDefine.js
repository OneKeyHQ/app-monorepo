// Single source of truth for the `platformEnv.* -> build-time literal` map fed
// to babel-plugin-transform-define.
//
// IMPORTANT: this map is consumed by TWO independent build pipelines, which do
// NOT share the babel config — keep them in ONE place so adding a platformEnv
// flag never silently diverges between native and web:
//   - babel (development/babelTools.js): React Native / metro, AND the
//     ext/desktop webpack builds (they load babel.config.js).
//   - rspack (development/rspack/rspack.base.config.ts): the apps/web build.
//     rspack runs swc and never loads babel.config.js, so it re-applies this
//     same map via its own babel-loader pass.
//
// The values come from packages/shared/src/buildTimeEnv (which derives them
// from process.env.ONEKEY_PLATFORM). Folding these to literals lets the
// minifier dead-code-eliminate platform branches (tree shaking).
//
// CommonJS on purpose: required from both the CJS babel config and the TS
// rspack config (mirrors buildTimeEnv.js / envExposedToClient.js).

/**
 * @param {Record<string, boolean>} buildTimeEnv - the buildTimeEnv module exports
 * @returns {Record<string, boolean>} platformEnv.* -> literal map
 */
function buildPlatformEnvDefineMap(buildTimeEnv) {
  return {
    'platformEnv.isJest': buildTimeEnv.isJest,
    'platformEnv.isDev': buildTimeEnv.isDev,
    'platformEnv.isE2E': buildTimeEnv.isE2E,
    'platformEnv.isProduction': buildTimeEnv.isProduction,
    'platformEnv.isWeb': buildTimeEnv.isWeb,
    'platformEnv.isWebEmbed': buildTimeEnv.isWebEmbed,
    'platformEnv.isDesktop': buildTimeEnv.isDesktop,
    'platformEnv.isExtension': buildTimeEnv.isExtension,
    'platformEnv.isNative': buildTimeEnv.isNative,
    'platformEnv.isExtChrome': buildTimeEnv.isExtChrome,
    'platformEnv.isExtFirefox': buildTimeEnv.isExtFirefox,
    'platformEnv.enableNativeBackgroundThread':
      buildTimeEnv.enableNativeBackgroundThread,
  };
}

module.exports = { buildPlatformEnvDefineMap };
