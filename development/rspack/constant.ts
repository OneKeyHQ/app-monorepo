const {
  WEB_PORT,
  PUBLIC_URL,
  NODE_ENV,
  EXT_MANIFEST_V3,
  ENABLE_ANALYZER,
  ENABLE_ANALYZER_HTML_REPORT,
  ANALYSE_MODULE,
  EXT_CHANNEL,
  ONEKEY_PROXY,
} = process.env;

export const webPort = WEB_PORT || '3000';
export const nodeEnv = NODE_ENV || 'development';
export const onekeyProxy = ONEKEY_PROXY;
export const isDev = nodeEnv !== 'production';
export const publicUrl = PUBLIC_URL;

export const isManifestV3 = !!EXT_MANIFEST_V3;
export const isManifestV2 = !isManifestV3;

export const enableAnalyzer = ENABLE_ANALYZER || false;
export const enableAnalyzerHtmlReport = ENABLE_ANALYZER_HTML_REPORT || false;
export const analyseModule = !!ANALYSE_MODULE;

export const extChannel = EXT_CHANNEL;

// Channels an extension build can target. Adding one means more than
// extending this list -- EXT_CHANNEL fans out to places that each have to learn
// the new value, and every one of them fails silently if it does not:
//
//  1. here, so applyExtChannelToEnv() stops rejecting it
//  2. packages/shared/src/buildTimeEnv.js -- add `isExt<Name>`
//  3. packages/shared/src/platformEnv.ts -- add it to IAppChannel, to the
//     buildTimeEnv destructure and its type, to getAppChannel(), and to the
//     exported platformEnv object. `isExtEdge` is missing from that last step
//     today, so `platformEnv.isExtEdge` is undefined even though the channel
//     itself resolves through getAppChannel()
//  4. development/platformEnvDefine.js -- add `platformEnv.isExt<Name>` so the
//     branch folds to a literal and dead-code-eliminates. `isExtEdge` is
//     missing here too, so edge branches ship unfolded
//  5. apps/ext/src/manifest/ -- add the manifest variant and branch on it in
//     index.js, which reads process.env.EXT_CHANNEL directly
//  6. the update service -- EPlatform, fullUpdatePlatformMapping and
//     DefaultPlatformInfo in server-service-utility, plus EPlatform and
//     FullUpdateSchema in server-service-dashboard. Without these the server
//     has no row matching `extension-<name>` and answers app-update with an
//     empty payload, which is exactly the OK-62971 failure this file caused.
export const EXT_CHANNELS = ['chrome', 'firefox', 'edge'] as const;

// EXT_CHANNEL is the only way to select an extension channel, e.g.
// `EXT_CHANNEL=firefox yarn app:ext:build`. This used to also honour
// --firefox/--chrome/--edge, but the rspack CLI rejects flags it does not
// declare ("CACError: Unknown option `--firefox`") before the config is ever
// loaded, so those branches were unreachable -- and they only inspected the
// last argument even before that. Removed rather than left as a selector that
// looks supported but silently resolves to the default.
export const targetBrowser: string = extChannel || 'chrome';

/**
 * Publish the resolved channel back to `process.env.EXT_CHANNEL`, which is what
 * the rest of the build actually reads: DefinePlugin substitutes it into
 * buildTimeEnv.js (driving platformEnv.appChannel and so the
 * `X-Onekey-Request-Platform` header), loadBuildTimeEnv folds
 * `platformEnv.isExtChrome`, and apps/ext/src/manifest/index.js selects the
 * Firefox manifest. All three read it lazily, so calling this while the ext
 * config module is evaluated is early enough.
 *
 * Call this ONLY from the extension config. EXT_CHANNEL is not namespaced by
 * platform, so setting it for every target would leak into the web/desktop
 * bundles: getAppChannel() tests the ext channels before the desktop ones, and
 * the WalletConnect client url is built from the same variable.
 */
export function applyExtChannelToEnv(): string {
  if (!(EXT_CHANNELS as readonly string[]).includes(targetBrowser)) {
    // Fail loudly: an unknown channel silently produces a Chrome manifest
    // with a bogus `extension-<channel>` platform header, which is how this
    // whole class of bug stayed invisible for two months.
    throw new Error(
      `Invalid EXT_CHANNEL "${targetBrowser}", expected one of ${EXT_CHANNELS.join(
        ', ',
      )}`,
    );
  }
  process.env.EXT_CHANNEL = targetBrowser;
  return targetBrowser;
}
