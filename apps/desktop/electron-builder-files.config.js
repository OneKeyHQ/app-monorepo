// Base files array and per-platform prebuild exclusions.
// Shared by all electron-builder platform configs.

// Base files included in asar. Bridge binaries are excluded here
// because they are added via extraResources per platform instead.
//
// `tradingview-assets/**/*` is the offline TradingView chart bundle, staged by
// development/scripts/fetch-tradingview-assets.mjs into apps/desktop/app/. It is
// deliberately OUTSIDE `build/` so it ships in the asar/installer but never enters
// the renderer hot-update bundle (which is just `build/` + its metadata.json).
// Absent on open-source / no-token builds — the glob then matches nothing and the
// app falls back to the online chart.
const baseFiles = [
  'dist/**/*',
  '!dist/__**',
  'build/**/*',
  '!build/static/bin/**/*',
  'tradingview-assets/**/*',
  'package.json',
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
