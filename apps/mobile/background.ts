/* eslint-disable import-js/order, @typescript-eslint/no-require-imports */

(
  globalThis as typeof globalThis & {
    __ONEKEY_RUNTIME_KIND__?: 'main' | 'background';
  }
).__ONEKEY_RUNTIME_KIND__ = 'background';

require('@onekeyhq/shared/src/polyfills');
require('./src/backgroundThread/setupBackgroundThreadRPCHandler');
require('@onekeyhq/kit/src/background/instance/backgroundApiProxy');

const { AppRegistry } =
  require('react-native') as typeof import('react-native');

const BackgroundThreadRoot = () => null;

AppRegistry.registerComponent('background', () => BackgroundThreadRoot);
