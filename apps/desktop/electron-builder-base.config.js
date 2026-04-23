/* eslint-disable no-template-curly-in-string */
const { getPath } = require('./scripts/utils');

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
  'electronFuses': {
    'runAsNode': false,
    'enableCookieEncryption': true,
    'enableNodeOptionsEnvironmentVariable': false,
    'enableNodeCliInspectArguments': false,
    'enableEmbeddedAsarIntegrityValidation': true,
    'onlyLoadAppFromAsar': true,
    // Keep file:// privileges enabled — disabling makes file:// an opaque origin,
    // breaking localStorage/sessionStorage/indexedDB for the main window.
    // Risk mitigation: the production file protocol interceptor in app.ts validates
    // all resolved paths stay within the build directory (path traversal guard).
    // TODO: migrate to custom app:// protocol to fully eliminate file:// privileges.
    'grantFileProtocolExtraPrivileges': true,
  },
  'afterSign': getPath('scripts/afterSign.js'),
  'afterPack': getPath('scripts/afterPack.js'),
};
module.exports = baseElectronBuilderConfig;
