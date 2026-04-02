/* eslint-disable no-template-curly-in-string */
require('../../development/env');
const baseElectronBuilderConfig = require('./electron-builder-base.config');

module.exports = {
  ...baseElectronBuilderConfig,
  'linux': {
    'extraResources': [
      {
        'from': 'app/build/static/bin/bridge/linux-${arch}',
        'to': 'bin/bridge',
      },
    ],
    'icon': 'app/build/static/images/icons/512x512.png',
    'artifactName': 'OneKey-Wallet-${version}-linux-${arch}.${ext}',
    'executableName': 'onekey-wallet',
    'category': 'Utility',
    'target': ['snap'],
  },
  // Refer: https://canonical-snap.readthedocs-hosted.com/reference/development/interfaces/raw-usb-interface/
  'snap': {
    'base': 'core24',
    'plugs': [
      'default',
      'raw-usb',
      'password-manager-service',
      {
        // GNOME 46 content snap for core24 (Ubuntu 24.04)
        // Provides GTK, GLib, and other GNOME runtime libraries.
        'gnome-46-2404': {
          'interface': 'content',
          'target': '$SNAP/gnome-platform',
          'default-provider': 'gnome-46-2404',
        },
      },
      {
        // Mesa GPU drivers for core24 (Ubuntu 24.04)
        // Provides up-to-date Mesa DRI drivers compatible with modern kernels.
        // Fixes GPU/EGL initialization failures on newer kernels (6.x+)
        // where the older Mesa from gnome-42-2204 had DRM ABI mismatches.
        'gpu-2404': {
          'interface': 'content',
          'target': '$SNAP/gpu-2404',
          'default-provider': 'mesa-2404',
        },
      },
    ],
    // gnome-46-2404 no longer bundles X11/GTK/audio libs (gnome-42-2204 did),
    // so they must be staged explicitly for Electron.
    // libgtk-3-0 pulls in X11, ATK, cairo, pango, cups, etc. via apt deps. // cspell:disable-line
    // NOTE: Use libasound2t64 (not libasound2). On Ubuntu 24.04+ libasound2 // cspell:disable-line
    // is a virtual package that may resolve to the oss4-salsa shim instead
    // of real ALSA, causing missing symbols (snd_device_name_get_hint) and // cspell:disable-line
    // libOSSlib.so errors. libasound2t64 is always the real ALSA library. // cspell:disable-line
    'stagePackages': ['default', 'libdbus-1-3', 'libgtk-3-0', 'libasound2t64'],
    // Override default stage exclusions from electron-builder template.
    // The template excludes X11/GTK/audio libs assuming gnome-3-28-1804
    // provides them, but gnome-46-2404 does not — so we must keep them.
    'appPartStage': [
      '-usr/lib/python*',
      '-usr/bin/python*',
      '-var/lib/ucf',
      '-usr/include',
      '-usr/share',
      '-usr/sbin',
      '-usr/bin',
    ],
    // gpu-2404 provides Mesa DRI/EGL drivers. desktop-common.sh sets some
    // GPU paths for gnome-platform, but gpu-2404 paths must also be present.
    // Both arch triplets are listed so the same config works for x64 and arm64.
    'environment': {
      'LD_LIBRARY_PATH': [
        '$SNAP_LIBRARY_PATH',
        // gpu-2404 MUST come before staged libs so its libgbm.so.1 // cspell:disable-line
        // is loaded instead of the staged one (which hardcodes host paths).
        '$SNAP/gpu-2404/usr/lib/x86_64-linux-gnu',
        '$SNAP/gpu-2404/usr/lib/x86_64-linux-gnu/gbm',
        '$SNAP/gpu-2404/usr/lib/aarch64-linux-gnu',
        '$SNAP/gpu-2404/usr/lib/aarch64-linux-gnu/gbm',
        '$SNAP/gnome-platform/usr/lib/x86_64-linux-gnu',
        '$SNAP/gnome-platform/usr/lib/aarch64-linux-gnu',
        '$SNAP/lib:$SNAP/usr/lib',
        '$SNAP/lib/x86_64-linux-gnu:$SNAP/usr/lib/x86_64-linux-gnu',
        '$SNAP/lib/aarch64-linux-gnu:$SNAP/usr/lib/aarch64-linux-gnu',
        '$LD_LIBRARY_PATH',
      ].join(':'),
      // Mesa DRI driver search path (gpu-2404 content snap).
      'LIBGL_DRIVERS_PATH': [
        '$SNAP/gpu-2404/usr/lib/x86_64-linux-gnu/dri',
        '$SNAP/gpu-2404/usr/lib/aarch64-linux-gnu/dri',
      ].join(':'),
      // EGL vendor ICD discovery for GLVND (gpu-2404 content snap). // cspell:disable-line
      // desktop-common.sh only sets this if /var/lib/snapd/lib/glvnd exists, // cspell:disable-line
      // which is empty on most systems. Without this, libEGL cannot find
      // libEGL_mesa.so.0 and EGL initialization fails.
      '__EGL_VENDOR_LIBRARY_DIRS':
        '$SNAP/gpu-2404/usr/share/glvnd/egl_vendor.d',
      // GIO extra modules (libgiolibproxy, etc.) from gnome-platform content snap. // cspell:disable-line
      // Use GIO_EXTRA_MODULES (not GIO_MODULE_DIR) because the latter only
      // accepts a single directory. Both arch triplets are listed since only
      // the matching one will exist at runtime; GLib ignores missing dirs.
      'GIO_EXTRA_MODULES': [
        '$SNAP/gnome-platform/usr/lib/x86_64-linux-gnu/gio/modules',
        '$SNAP/gnome-platform/usr/lib/aarch64-linux-gnu/gio/modules',
      ].join(':'),
    },
  },
};
