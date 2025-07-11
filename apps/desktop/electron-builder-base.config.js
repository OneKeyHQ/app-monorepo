const { getPath } = require('./scripts/utils');

/* eslint-disable no-template-curly-in-string */
require('../../development/env');

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
  'files': [
    'dist/**/*',
    '!dist/__**',
    'build/**/*',
    '!build/static/bin/**/*',
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
  'afterSign': getPath('scripts/afterSign.js'),
  'afterPack': getPath('scripts/afterPack.js'),
};
module.exports = baseElectronBuilderConfig;
