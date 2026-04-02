/* eslint-disable import-js/order, @typescript-eslint/no-require-imports */

// Track JS background entry execution start time
(globalThis as any).__ONEKEY_BG_ENTRY_START__ = Date.now();

(
  globalThis as typeof globalThis & {
    __ONEKEY_RUNTIME_KIND__?: 'main' | 'background';
  }
).__ONEKEY_RUNTIME_KIND__ = 'background';

require('@onekeyhq/shared/src/polyfills');

// Install production split bundle loader for background runtime (Phase 3).
// Uses BackgroundThread.loadSegmentInBackground to register segments
// with the background Hermes runtime.
if (!__DEV__) {
  const { getSegmentManifest } =
    require('./src/splitBundle/segmentManifest') as typeof import('./src/splitBundle/segmentManifest');
  const manifest = getSegmentManifest();
  if (Object.keys(manifest.segments).length > 0) {
    const { installProdBundleLoader } =
      require('./src/splitBundle/installProdBundleLoader') as typeof import('./src/splitBundle/installProdBundleLoader');
    const { getBackgroundNativeSplitBundleLoader } =
      require('./src/splitBundle/nativeBridgeBackground') as typeof import('./src/splitBundle/nativeBridgeBackground');
    installProdBundleLoader(getBackgroundNativeSplitBundleLoader());
  }
}
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

const entryElapsed =
  Date.now() - ((globalThis as any).__ONEKEY_BG_ENTRY_START__ || Date.now());
// eslint-disable-next-line no-console
console.log(`[SplitBundle] background entry JS executed in ${entryElapsed}ms`);
