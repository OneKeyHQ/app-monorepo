const { getPath } = require('./scripts/utils');

/* eslint-disable no-template-curly-in-string */
require('../../development/env');

// Base files array shared by all platform configs.
const baseFiles = [
  'dist/**/*',
  '!dist/__**',
  'build/**/*',
  '!build/static/bin/**/*',
  'package.json',
];

// Prebuild exclusion globs per platform.
// Each array excludes native prebuilds for all platforms EXCEPT the target.
const macExcludePrebuilds = [
  '!**/prebuilds/android-*/**',
  '!**/prebuilds/linux-*/**',
  '!**/prebuilds/win32-*/**',
];
const winExcludePrebuilds = [
  '!**/prebuilds/android-*/**',
  '!**/prebuilds/darwin-*/**',
  '!**/prebuilds/linux-*/**',
];
const linuxExcludePrebuilds = [
  '!**/prebuilds/android-*/**',
  '!**/prebuilds/darwin-*/**',
  '!**/prebuilds/win32-*/**',
];

const baseElectronBuilderConfig = {
  'extraMetadata': {
    'main': 'dist/app.js',
    'version': process.env.VERSION,
  },
  'appId': 'so.onekey.wallet.desktop',
  'productName': 'OneKey',
  'copyright': 'Copyright © ${author}',
  'asar': true,
  'buildVersion': process.env.BUILD_NUMBER,
  'directories': {
    'output': 'build-electron',
  },
  'npmRebuild': false,
  'files': baseFiles,
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
  'afterSign': getPath('scripts/afterSign.js'),
  'afterPack': getPath('scripts/afterPack.js'),
};
module.exports = baseElectronBuilderConfig;
module.exports.baseFiles = baseFiles;
module.exports.macExcludePrebuilds = macExcludePrebuilds;
module.exports.winExcludePrebuilds = winExcludePrebuilds;
module.exports.linuxExcludePrebuilds = linuxExcludePrebuilds;
