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
const winExcludePrebuilds = [
  '!**/prebuilds/android-*/**',
  '!**/prebuilds/darwin-*/**',
  '!**/prebuilds/linux-*/**',
  // node-gyp-build loads build/Release BEFORE prebuilds/, so a binding
  // compiled on the packaging machine (e.g. a mac Mach-O when cross-packaging
  // win from macOS) shadows the correct win32 prebuild shipped in the npm
  // package and fails at runtime with "not a valid Win32 application".
  // Every excluded module here ships win32 prebuilds to fall back to.
  '!**/node_modules/@stoprocent/noble/build/**',
  '!**/node_modules/@stoprocent/bluetooth-hci-socket/build/**',
  '!**/node_modules/usb/build/**',
  '!**/node_modules/@serialport/bindings-cpp/build/**',
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
