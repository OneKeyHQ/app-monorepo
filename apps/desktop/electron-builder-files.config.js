// Base files array and per-platform prebuild exclusions.
// Shared by all electron-builder platform configs.

// Base files included in asar. Bridge binaries are excluded here
// because they are added via extraResources per platform instead.
// These patterns are relative to apps/desktop/app, which electron-builder
// detects as the appDir in the two-package desktop layout.
const baseFiles = [
  'dist/**/*',
  '!dist/__**',
  'build/**/*',
  '!build/static/bin/**/*',
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
// Cross-packaging a win build from a non-Windows host (local debugging only —
// release CI runs on windows-2025). node-gyp-build loads build/Release BEFORE
// prebuilds/, so bindings compiled on the packaging host are Mach-O and fail
// at runtime with "not a valid Win32 application". Dropping them lets the
// bundled win32 prebuilds load instead. NOT applied on a Windows host, where
// build/Release is the correct, ABI-matched binary and must ship as-is.
const winCrossPackagingExcludes =
  process.platform === 'win32'
    ? []
    : [
        '!**/node_modules/@stoprocent/noble/build/**',
        '!**/node_modules/@stoprocent/bluetooth-hci-socket/build/**',
        '!**/node_modules/usb/build/**',
        '!**/node_modules/@serialport/bindings-cpp/build/**',
      ];

const winExcludePrebuilds = [
  '!**/prebuilds/android-*/**',
  '!**/prebuilds/darwin-*/**',
  '!**/prebuilds/linux-*/**',
  ...winCrossPackagingExcludes,
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
