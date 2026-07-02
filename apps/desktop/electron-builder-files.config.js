// Base files array and per-platform prebuild exclusions.
// Shared by all electron-builder platform configs.

// Base files included in asar. Bridge binaries are excluded here
// because they are added via extraResources per platform instead.
//
// `tradingview-assets/**/*` is the offline TradingView chart bundle staged by
// development/scripts/fetch-tradingview-assets.mjs. It is deliberately outside
// build/ so it ships in the installer/asar but never enters the JS hot-update
// bundle.
// These patterns are relative to apps/desktop/app, which electron-builder
// detects as the appDir in the two-package desktop layout.
const baseFiles = [
  'dist/**/*',
  '!dist/__**',
  'build/**/*',
  '!build/static/bin/**/*',
  'tradingview-assets/**/*',
  'package.json',
  '!README.md',
];

// Prebuild exclusion globs per platform.
// Each array excludes native prebuilds for all platforms EXCEPT the target.
const macExcludePrebuilds = [
  '!**/prebuilds/android-*/**',
  '!**/prebuilds/linux-*/**',
  '!**/prebuilds/win32-*/**',
];
const winExcludePrebuilds = [
  '!**/prebuilds/android-*/**',
  '!**/prebuilds/darwin-*/**',
  '!**/prebuilds/linux-*/**',
];
const linuxExcludePrebuilds = [
  '!**/prebuilds/android-*/**',
  '!**/prebuilds/darwin-*/**',
  '!**/prebuilds/win32-*/**',
];

module.exports = {
  baseFiles,
  macExcludePrebuilds,
  winExcludePrebuilds,
  linuxExcludePrebuilds,
};
