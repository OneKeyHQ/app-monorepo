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
    'stagePackages': [
      'default',
      'libdbus-1-3',
      'libgtk-3-0',
      'libgbm1',
      'libasound2',
    ],
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
  },
};
