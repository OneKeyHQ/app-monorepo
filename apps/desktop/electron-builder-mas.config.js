// oxlint-disable no-template-curly-in-string -- electron-builder template syntax
const baseElectronBuilderConfig = require('./electron-builder-base.config');
const {
  baseFiles,
  macExcludePrebuilds,
} = require('./electron-builder-files.config');
const { verifyBuild } = require('./scripts/build-revenuecat-macos');

const masBuildNumber = process.env.MAS_BUILD_NUMBER;
if (masBuildNumber && !/^[1-9]\d*$/.test(masBuildNumber)) {
  // oxlint-disable-next-line onekey/no-raw-error -- This build config cannot import the application runtime.
  throw new Error('MAS_BUILD_NUMBER must be a positive integer');
}

module.exports = {
  ...baseElectronBuilderConfig,
  'beforePack': async () => verifyBuild(),
  'appId': 'so.onekey.wallet',
  'buildVersion': masBuildNumber || `${process.env.BUILD_NUMBER}0`,
  'dmg': {
    'sign': false,
  },
  'mac': {
    'files': [...baseFiles, ...macExcludePrebuilds],
    'identity': null,
    'icon': 'app/build/static/images/icons/icon.icns',
    'artifactName': 'OneKey-Wallet-${version}-mac-${arch}.${ext}',
    'hardenedRuntime': true,
    'darkModeSupport': false,
    'category': 'public.app-category.finance',
    'target': [{ target: 'mas', arch: 'universal' }],
    'entitlements': 'entitlements.mac.plist',
    'x64ArchFiles': '*',
    'extraResources': [
      {
        'from': 'native-modules/revenuecat-macos/build/universal',
        'to': 'revenuecat',
        'filter': [
          '*.node',
          '*.dylib',
          '*.js',
          '*-LICENSE.txt',
          'build-info.json',
        ],
      },
      {
        'from': 'native-modules/revenuecat-macos/build/universal/Resources',
        'to': '.',
      },
      {
        'from': 'resources/icons/Assets.car',
        'to': 'Assets.car',
      },
    ],
    'extendInfo': {
      'CFBundleIconName': 'OneKeyLogo',
      'NSCameraUsageDescription': 'Use Camera to scan QR Code.',
      'NSMicrophoneUsageDescription': 'Use Microphone to record videos.',
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
      'CFBundleIconName': 'OneKeyLogo',
      'ElectronTeamID': 'BVJ3FU5H2K',
      'ITSAppUsesNonExemptEncryption': false,
      'NSMicrophoneUsageDescription': 'Use Microphone to record videos.',
      'NSBluetoothAlwaysUsageDescription':
        'OneKey wallet needs Bluetooth access to communicate with hardware wallets',
      'NSBluetoothPeripheralUsageDescription':
        'OneKey wallet needs Bluetooth access to discover and connect with hardware wallets',
    },
  },
  'asarUnpack': ['**/*.node'],
};
