/* eslint-disable no-template-curly-in-string */
require('../../development/env');
const baseElectronBuilderConfig = require('./electron-builder-base.config');
const { getDesktopBuildVariant } = require('./scripts/build-variant');

const { artifactPrefix, iconPngPath } = getDesktopBuildVariant();

module.exports = {
  ...baseElectronBuilderConfig,
  'linux': {
    'extraResources': [
      {
        'from': 'app/build/static/bin/bridge/linux-${arch}',
        'to': 'bin/bridge',
      },
    ],
    'icon': iconPngPath,
    'artifactName': `${artifactPrefix}-\${version}-linux-\${arch}.\${ext}`,
    'executableName': 'onekey-wallet',
    'category': 'Utility',
    'target': ['snap'],
  },
  // Refer: https://canonical-snap.readthedocs-hosted.com/reference/development/interfaces/raw-usb-interface/
  'snap': {
    'plugs': ['default', 'raw-usb'],
  },
};
