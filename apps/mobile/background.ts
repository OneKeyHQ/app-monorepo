/* eslint-disable import-js/order, @typescript-eslint/no-require-imports */

// Track JS background entry execution start time
(globalThis as any).__ONEKEY_BG_ENTRY_START__ = Date.now();

(
  globalThis as typeof globalThis & {
    __ONEKEY_RUNTIME_KIND__?: 'main' | 'background';
  }
).__ONEKEY_RUNTIME_KIND__ = 'background';

require('@onekeyhq/shared/src/polyfills');

// Lightweight logger for background runtime entry diagnostics.
// Uses NativeLogger directly (no console) so output goes to app-latest.log.
const bgEntryLog = (msg: string) => {
  try {
    const { NativeLogger, LogLevel } =
      require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
    NativeLogger.write(LogLevel.Info, `[BackgroundEntry] ${msg}`);
  } catch { /* NativeLogger unavailable before TurboModule init */ }
};
bgEntryLog('polyfills loaded');

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

// In three-bundle mode, common.jsbundle has a stub for backgroundApiInit
// (Metro resolver replaces it with native-ui stub to tree-shake BackgroundApi
// out of common/main bundles). The background runtime needs the real BackgroundApi,
// so we create it here and inject it into the proxy BEFORE it's used.
bgEntryLog('creating real BackgroundApi');
const platformEnv = (require('@onekeyhq/shared/src/platformEnv') as typeof import('@onekeyhq/shared/src/platformEnv')).default;
globalThis.$onekeyIsInBackground =
  platformEnv.isExtensionBackground || platformEnv.isNativeBackgroundThread;
const { default: BackgroundApi } =
  require('@onekeyhq/kit-bg/src/apis/BackgroundApi') as typeof import('@onekeyhq/kit-bg/src/apis/BackgroundApi');
const realBackgroundApi = new BackgroundApi();
bgEntryLog('BackgroundApi created');

bgEntryLog('importing backgroundApiProxy');
const backgroundApiProxy = (
  require('@onekeyhq/kit/src/background/instance/backgroundApiProxy') as typeof import('@onekeyhq/kit/src/background/instance/backgroundApiProxy')
).default;

// Inject the real BackgroundApi into the proxy (replacing the stub's null).
// This must happen before any RPC request is handled.
(backgroundApiProxy as any).backgroundApi = realBackgroundApi;
(backgroundApiProxy as any).backgroundApiFactory = () => realBackgroundApi;
bgEntryLog('backgroundApiProxy injected with real BackgroundApi');

bgEntryLog('importing RPC handler');
const { setBackgroundThreadRequestExecutor } =
  require('./src/backgroundThread/setupBackgroundThreadRPCHandler') as typeof import('./src/backgroundThread/setupBackgroundThreadRPCHandler');

const { AppRegistry } =
  require('react-native') as typeof import('react-native');

bgEntryLog('registering request executor');
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
bgEntryLog(`entry JS executed in ${entryElapsed}ms`);
