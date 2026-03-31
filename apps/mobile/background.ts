/* eslint-disable import-js/order, @typescript-eslint/no-require-imports */

(
  globalThis as typeof globalThis & {
    __ONEKEY_RUNTIME_KIND__?: 'main' | 'background';
  }
).__ONEKEY_RUNTIME_KIND__ = 'background';

require('@onekeyhq/shared/src/polyfills');
const { setBackgroundThreadRequestExecutor } =
  require('./src/backgroundThread/setupBackgroundThreadRPCHandler') as typeof import('./src/backgroundThread/setupBackgroundThreadRPCHandler');
const backgroundApiProxy = (
  require('@onekeyhq/kit/src/background/instance/backgroundApiProxy') as typeof import('@onekeyhq/kit/src/background/instance/backgroundApiProxy')
).default;

const { AppRegistry } =
  require('react-native') as typeof import('react-native');

setBackgroundThreadRequestExecutor(async (request) => {
  if (request.type === 'service-call') {
    return backgroundApiProxy.callBackgroundMethod(
      request.sync,
      request.method,
      ...request.params,
    );
  }
  if (request.type === 'bridge-call') {
    return backgroundApiProxy.bridgeReceiveHandler(request.payload);
  }

  return undefined;
});

const BackgroundThreadRoot = () => null;

AppRegistry.registerComponent('background', () => BackgroundThreadRoot);
