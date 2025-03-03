/* eslint-disable no-template-curly-in-string */
require('../../development/env');
const baseElectronBuilderConfig = require('./electron-builder-base.config');

module.exports = {
  ...baseElectronBuilderConfig,
  'dmg': {
    'sign': false,
  },
  'mac': {
    'identity': null,
    'icon': 'app/build/static/images/icons/icon.icns',
    'artifactName': 'OneKey-Wallet-${version}-mac-${arch}.${ext}',
    'hardenedRuntime': true,
    'darkModeSupport': false,
    'category': 'public.app-category.finance',
    'target': [{ target: 'mas', arch: 'universal' }],
    'entitlements': 'entitlements.mac.plist',
    'extendInfo': {
      'NSCameraUsageDescription': 'Use Camera to scan QR Code.',
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
    'extendInfo': {
      'ElectronTeamID': 'BVJ3FU5H2K',
      'ITSAppUsesNonExemptEncryption': false,
    },
  },
  'asarUnpack': ['**/*.node'],
};
