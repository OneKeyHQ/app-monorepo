const path = require('path');
const DLLs = require('./electron-dll.config');

/* eslint-disable no-template-curly-in-string */
require('../../development/env');

const getPath = (...paths) => {
  console.log(path.join(__dirname, ...paths));
  return path.join(__dirname, ...paths)
};

module.exports = {
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
  'files': [
    'dist/**/*',
    '!dist/__**',
    getPath('build/**/*'),
    `!${getPath('build/static/bin/**/*')}`,
    getPath('package.json'),
  ],
  'protocols': {
    'name': 'electron-deep-linking',
    'schemes': ['onekey-wallet', 'wc', 'ethereum'],
  },
  'extraResources': [
    {
      'from': getPath('build/static/images/icons/512x512.png'),
      'to': 'static/images/icons/512x512.png',
    },
    {
      'from': getPath('build/static/preload.js'),
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
    'icon': getPath('build/static/images/icons/dmg.icns'),
    'background': getPath('build/static/images/icons/background.tiff'),
  },
  'nsis': {
    'oneClick': false,
    'installerSidebar': getPath(
      'build/static/images/icons/installerSidebar.bmp',
    ),
    'deleteAppDataOnUninstall': true,
  },
  'mac': {
    'extraResources': [
      {
        'from': getPath('build/static/bin/bridge/mac-${arch}'),
        'to': 'bin/bridge',
      },
    ],
    'icon': getPath('build/static/images/icons/512x512.png'),
    'artifactName': 'OneKey-Wallet-${version}-mac-${arch}.${ext}',
    'hardenedRuntime': true,
    'gatekeeperAssess': false,
    'darkModeSupport': false,
    'category': 'productivity',
    'target': [
      { target: 'dmg', arch: ['x64', 'arm64'] },
      { target: 'zip', arch: ['x64', 'arm64'] },
    ],
    'entitlements': 'entitlements.mac.plist',
    'extendInfo': {
      'NSCameraUsageDescription': 'Please allow OneKey to use your camera',
    },
  },
  'win': {
    'extraResources': [
      {
        'from': getPath('build/static/bin/bridge/win-${arch}'),
        'to': 'bin/bridge',
      },
    ],
    'extraFiles': [...DLLs],
    'icon': getPath('build/static/images/icons/512x512.png'),
    'artifactName': 'OneKey-Wallet-${version}-win-${arch}.${ext}',
    'verifyUpdateCodeSignature': false,
    'target': [{ target: 'nsis', arch: ['x64', 'arm64'] }],
  },
  'linux': {
    'extraResources': [
      {
        'from': 'build/static/bin/bridge/linux-${arch}',
        'to': 'bin/bridge',
      },
    ],
    'icon': getPath('build/static/images/icons/512x512.png'),
    'artifactName': 'OneKey-Wallet-${version}-linux-${arch}.${ext}',
    'executableName': 'onekey-wallet',
    'category': 'Utility',
    'target': [{ target: 'AppImage', arch: ['x64', 'arm64'] }],
  },
  'afterSign': getPath('scripts/notarize.js'),
  'afterPack': getPath('scripts/fileOperation.js'),
};
