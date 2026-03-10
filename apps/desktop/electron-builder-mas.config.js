// oxlint-disable no-template-curly-in-string -- electron-builder template syntax
const baseElectronBuilderConfig = require('./electron-builder-base.config');
const { getDesktopBuildVariant } = require('./scripts/build-variant');

const { artifactPrefix, iconIcnsPath, liquidIconName } =
  getDesktopBuildVariant();

module.exports = {
  ...baseElectronBuilderConfig,
  'appId': 'so.onekey.wallet',
  'buildVersion': `${process.env.BUILD_NUMBER}0`,
  'dmg': {
    'sign': false,
  },
  'mac': {
    'identity': null,
    'icon': iconIcnsPath,
    'artifactName': `${artifactPrefix}-\${version}-mac-\${arch}.\${ext}`,
    'hardenedRuntime': true,
    'darkModeSupport': false,
    'category': 'public.app-category.finance',
    'target': [{ target: 'mas', arch: 'universal' }],
    'entitlements': 'entitlements.mac.plist',
    'x64ArchFiles': '*',
    'extraResources': [
      {
        'from': 'resources/icons/Assets.car',
        'to': 'Assets.car',
      },
    ],
    'extendInfo': {
      'CFBundleIconName': liquidIconName,
      'NSCameraUsageDescription': 'Use Camera to scan QR Code.',
      'NSBluetoothAlwaysUsageDescription':
        'OneKey wallet needs Bluetooth access to communicate with hardware wallets',
      'NSBluetoothPeripheralUsageDescription':
        'OneKey wallet needs Bluetooth access to discover and connect with hardware wallets',
    },
  },
  'mas': {
    'hardenedRuntime': false,
    // 'mergeASARs': false,
    'gatekeeperAssess': true,
    'entitlements': 'entitlements.mas.plist',
    'entitlementsInherit': 'entitlements.mas.inherit.plist',
    'entitlementsLoginHelper': 'entitlements.mas.loginhelper.plist',
    'provisioningProfile': 'OneKey_Mac_App.provisionprofile',
    'x64ArchFiles': '*',
    'extendInfo': {
      'CFBundleIconName': liquidIconName,
      'ElectronTeamID': 'BVJ3FU5H2K',
      'ITSAppUsesNonExemptEncryption': false,
      'NSBluetoothAlwaysUsageDescription':
        'OneKey wallet needs Bluetooth access to communicate with hardware wallets',
      'NSBluetoothPeripheralUsageDescription':
        'OneKey wallet needs Bluetooth access to discover and connect with hardware wallets',
    },
  },
  'asarUnpack': ['**/*.node'],
};
