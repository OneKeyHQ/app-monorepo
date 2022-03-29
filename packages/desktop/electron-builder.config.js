/* eslint-disable no-template-curly-in-string */
require('../../development/env');

module.exports = {
  'extraMetadata': {
    'main': 'dist/app.js',
    'version': process.env.VERSION,
  },
  'appId': 'so.onekey.wallet.desktop',
  'productName': 'OneKey Wallet',
  'copyright': 'Copyright © ${author}',
  'asar': true,
  'electronVersion': '15.3.1',
  'buildVersion': process.env.BUILD_NUMBER,
  'directories': {
    'output': 'build-electron',
  },
  'files': [
    'build/**/*',
    '!build/static/bin/**/*',
    'dist/**/*.js',
    '!dist/__**',
    'package.json',
  ],
  'extraResources': [
    {
      'from': 'build/static/images/icons/512x512.png',
      'to': 'images/icons/512x512.png',
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
    'background': 'build/static/images/icons/background.png',
  },
  'nsis': {
    'oneClick': false,
  },
  'mac': {
    'extraResources': [
      {
        'from': 'build/static/bin/bridge/mac-${arch}',
        'to': 'bin/bridge',
      },
    ],
    'icon': 'build/static/images/icons/512x512.png',
    'artifactName': 'OneKey-Wallet-${version}-mac-${arch}.${ext}',
    'hardenedRuntime': true,
    'gatekeeperAssess': false,
    'darkModeSupport': false,
    'category': 'productivity',
    'target': ['dmg', 'zip'],
  },
  'win': {
    'extraResources': [
      {
        'from': 'build/static/bin/bridge/win-${arch}',
        'to': 'bin/bridge',
      },
    ],
    'icon': 'build/static/images/icons/512x512.png',
    'artifactName': 'OneKey-Wallet-${version}-win-${arch}.${ext}',
    'verifyUpdateCodeSignature': false,
    'target': ['nsis'],
  },
  'linux': {
    'extraResources': [
      {
        'from': 'build/static/bin/bridge/linux-${arch}',
        'to': 'bin/bridge',
      },
    ],
    'icon': 'build/static/images/icons/512x512.png',
    'artifactName': 'OneKey-Wallet-${version}-linux-${arch}.${ext}',
    'executableName': 'onekey-wallet',
    'category': 'Utility',
    'target': ['AppImage'],
  },
  'afterSign': 'scripts/notarize.js',
};
