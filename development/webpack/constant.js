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

exports.WEB_PORT = WEB_PORT || 3000;
exports.NODE_ENV = NODE_ENV || 'development';
exports.ONEKEY_PROXY = ONEKEY_PROXY;
exports.isDev = exports.NODE_ENV !== 'production';
exports.PUBLIC_URL = PUBLIC_URL;

exports.isManifestV3 = !!EXT_MANIFEST_V3;
exports.isManifestV2 = !exports.isManifestV3;

exports.ENABLE_ANALYZER = ENABLE_ANALYZER || false;
exports.ENABLE_ANALYZER_HTML_REPORT = ENABLE_ANALYZER_HTML_REPORT || false;
exports.ANALYSE_MODULE = !!ANALYSE_MODULE;

exports.EXT_CHANNEL = EXT_CHANNEL;

// Kept in sync with development/rspack/constant.ts, which is where extension
// channels actually live now -- #12498 moved the extension off webpack, so this
// file is only reached through apps/web/webpack.config.kill-switch.js. There
// TARGET_BROWSER merely feeds createResolveExtensions, which is itself gated on
// EXT_CHANNEL being set, and the web build never sets it.
//
// What used to be here could not work: --firefox/--chrome/--edge were matched
// against the last argv entry only, and the trailing `else` overwrote the
// result with 'chrome' unconditionally, so EXT_CHANNEL was never read at all.
exports.TARGET_BROWSER = EXT_CHANNEL || 'chrome';
