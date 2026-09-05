// oxlint-disable no-template-curly-in-string -- electron-builder template syntax
const baseElectronBuilderConfig = require('./electron-builder-base.config');
const {
  baseFiles,
  winExcludePrebuilds,
} = require('./electron-builder-files.config');
const DLLs = require('./electron-dll.config');

module.exports = {
  ...baseElectronBuilderConfig,
  asarUnpack: [
    '**/node_modules/@stoprocent/noble/**/*',
    '**/node_modules/@stoprocent/bluetooth-hci-socket/**',
  ],

  'nsis': {
    'oneClick': false,
    'include': 'resources/windows/installer.nsh',
    'installerSidebar': 'app/build/static/images/icons/installerSidebar.bmp',
    'installerIcon': 'app/build/static/images/icons/installerIcon.ico',
    'uninstallerIcon': 'app/build/static/images/icons/installerIcon.ico',
    'deleteAppDataOnUninstall': true,
  },
  'win': {
    'files': [...baseFiles, ...winExcludePrebuilds],
    'extraResources': [
      {
        'from': 'app/build/static/bin/bridge/win-${arch}',
        'to': 'bin/bridge',
      },
      // Same layout as the regular win build — without it isBlePairAvailable()
      // finds no helper and Trezor BLE pairing silently degrades in Store builds.
      {
        'from': 'app/build/static/bin/ble-pair/win-${arch}',
        'to': 'bin/ble-pair',
      },
    ],
    'extraFiles': [
      ...DLLs,
      {
        'from': 'resources/windows/notificationIcon.ico',
        'to': 'resources/windows/notificationIcon.ico',
      },
    ],
    'icon': 'app/build/static/images/icons/installerIcon.ico',
    'artifactName': 'OneKey-Wallet-${version}-win-store-${arch}.${ext}',
    'verifyUpdateCodeSignature': false,
    'target': [{ target: 'nsis', arch: ['x64', 'arm64'] }],
  },
};
