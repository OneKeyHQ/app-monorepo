const baseElectronBuilderConfig = require('./electron-builder-base.config');
const DLLs = require('./electron-dll.config');
const { getPath } = require('./scripts/utils');

module.exports = {
  ...baseElectronBuilderConfig,
  'dmg': {
    'sign': false,
    'contents': [
      {
        'x': 410,
        'y': 175,
        'type': 'link',
        'path': '/Applications',
      },
      {
        'x': 130,
        'y': 175,
        'type': 'file',
      },
    ],
    'icon': 'app/build/static/images/icons/dmg.icns',
    'background': 'app/build/static/images/icons/background.tiff',
  },
  'nsis': {
    'oneClick': false,
    'installerSidebar': 'app/build/static/images/icons/installerSidebar.bmp',
    'deleteAppDataOnUninstall': true,
  },
  'mac': {
    'extraResources': [
      {
        'from': 'app/build/static/bin/bridge/mac-${arch}',
        'to': 'bin/bridge',
      },
    ],
    'icon': 'app/build/static/images/icons/512x512.png',
    'artifactName': 'OneKey-Wallet-${version}-mac-${arch}.${ext}',
    'hardenedRuntime': true,
    'gatekeeperAssess': false,
    'darkModeSupport': false,
    'category': 'productivity',
    'target': [
      { target: 'dmg', arch: ['x64', 'arm64', 'universal'] },
      { target: 'zip', arch: ['x64', 'arm64', 'universal'] },
    ],
    'provisioningProfile': 'OneKey_Mac_App.provisionprofile',
    'entitlements': getPath('entitlements.mac.plist'),
    'entitlementsInherit': 'entitlements.mas.inherit.plist',
    'entitlementsLoginHelper': 'entitlements.mas.loginhelper.plist',
    'extendInfo': {
      'ElectronTeamID': 'BVJ3FU5H2K',
      'ITSAppUsesNonExemptEncryption': false,
      'NSCameraUsageDescription': 'Please allow OneKey to use your camera',
      'NSBluetoothAlwaysUsageDescription':
        'OneKey wallet needs Bluetooth access to communicate with hardware wallets',
      'NSBluetoothPeripheralUsageDescription':
        'OneKey wallet needs Bluetooth access to discover and connect with hardware wallets',
    },
  },
  'win': {
    'extraResources': [
      {
        'from': 'app/build/static/bin/bridge/win-${arch}',
        'to': 'bin/bridge',
      },
    ],
    'extraFiles': DLLs,
    'icon': 'app/build/static/images/icons/512x512.png',
    'artifactName': 'OneKey-Wallet-${version}-win-${arch}.${ext}',
    'verifyUpdateCodeSignature': false,
    'target': [{ target: 'nsis', arch: ['x64', 'arm64'] }],
  },
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
    'target': [{ target: 'AppImage', arch: ['x64', 'arm64'] }],
  },
};
