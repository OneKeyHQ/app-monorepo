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
    'base': 'core22',
    'plugs': [
      'default',
      'raw-usb',
      {
        // Override default gnome-3-28-1804 with gnome-42-2204 (Ubuntu 22.04)
        // to fix GSettings schema errors on newer Linux systems.
        // 'content' attribute must match the slot in gnome-42-2204 snap
        // for snapd to establish the content interface connection.
        'gnome-3-28-1804': {
          'interface': 'content',
          'content': 'gnome-42-2204',
          'target': '$SNAP/gnome-platform',
          'default-provider': 'gnome-42-2204',
        },
      },
    ],
    // Adding libdbus-1-3 to stagePackages forces snapcraft full build // cspell:disable-line
    // instead of using the outdated template app (gnome-3-28-1804) // cspell:disable-line
    'stagePackages': ['default', 'libdbus-1-3'],
  },
};
