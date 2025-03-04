/* eslint-disable no-template-curly-in-string */

// WARNING: This configuration only works with electron-builder@23.6.0
// Do not upgrade electron-builder version as it may break the build
require('../../development/env');

module.exports = {
  'extraMetadata': {
    'main': 'dist/app.js',
    'version': process.env.VERSION,
  },
  'appId': 'so.onekey.wallet',
  'productName': 'OneKey',
  'copyright': 'Copyright © ${author}',
  'asar': true,
  'buildVersion': `${process.env.BUILD_NUMBER}0`,
  'directories': {
    'output': 'build-electron',
  },
  'npmRebuild': false,
  'files': [
    'build/**/*',
    '!build/static/bin/**/*',
    'dist/**/*.js',
    '!dist/__**',
    'package.json',
  ],
  'protocols': {
    'name': 'electron-deep-linking',
    'schemes': ['onekey-wallet', 'wc', 'ethereum'],
  },
  'extraResources': [
    {
      'from': 'app/build/static/images/icons/512x512.png',
      'to': 'static/images/icons/512x512.png',
    },
    {
      'from': 'app/build/static/images/icons/icon.icns',
      'to': 'static/images/icons/icon.icns',
    },
    {
      'from': 'app/build/static/preload.js',
      'to': 'static/preload.js',
    },
  ],
  'publish': {
    'provider': 'github',
    'repo': 'app-monorepo',
    'owner': 'OneKeyHQ',
  },
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
  'afterSign': 'scripts/afterSign.js',
  'afterPack': 'scripts/afterPack.js',
  'asarUnpack': ['**/*.node'],
};
