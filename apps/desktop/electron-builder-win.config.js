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

  nsis: {
    oneClick: false,
    include: 'resources/windows/installer.nsh',
    installerSidebar: 'app/build/static/images/icons/installerSidebar.bmp',
    installerIcon: 'app/build/static/images/icons/installerIcon.ico',
    uninstallerIcon: 'app/build/static/images/icons/installerIcon.ico',
    deleteAppDataOnUninstall: true,
  },
  win: {
    files: [...baseFiles, ...winExcludePrebuilds],
    extraResources: [
      {
        from: 'app/build/static/bin/bridge/win-${arch}',
        to: 'bin/bridge',
      },
      // Windows BLE OS-pairing helper (onekey-ble-pair). Same layout as bridge:
      // commit the built exe to public/static/bin/ble-pair/win-<arch>/ and the
      // renderer build stages it into app/build/static. Missing arch (e.g.
      // arm64 before it is built) simply means no helper → app falls back.
      {
        from: 'app/build/static/bin/ble-pair/win-${arch}',
        to: 'bin/ble-pair',
      },
    ],
    extraFiles: [
      ...DLLs,
      {
        from: 'resources/windows/notificationIcon.png',
        to: 'resources/windows/notificationIcon.png',
      },
    ],
    icon: 'app/build/static/images/icons/installerIcon.ico',
    artifactName: 'OneKey-Wallet-${version}-win-${arch}.${ext}',
    verifyUpdateCodeSignature: false,
    target: [{ target: 'nsis', arch: ['x64', 'arm64'] }],
  },
};
