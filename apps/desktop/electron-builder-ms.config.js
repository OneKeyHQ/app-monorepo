const DLLs = require('./electron-dll.config');
const baseElectronBuilderConfig = require('./electron-builder-base.config');

module.exports = {
  ...baseElectronBuilderConfig,
  'nsis': {
    'oneClick': false,
    'installerSidebar': 'app/build/static/images/icons/installerSidebar.bmp',
    'deleteAppDataOnUninstall': true,
  },
  'win': {
    'extraResources': [
      {
        'from': 'app/build/static/bin/bridge/win-${arch}',
        'to': 'bin/bridge',
      },
    ],
    'extraFiles': [...DLLs],
    'icon': 'app/build/static/images/icons/512x512.png',
    'artifactName': 'OneKey-Wallet-${version}-win-store-${arch}.${ext}',
    'verifyUpdateCodeSignature': false,
    'target': [{ target: 'nsis', arch: ['x64', 'arm64'] }],
  },
};
