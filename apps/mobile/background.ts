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
  } catch {
    /* NativeLogger unavailable before TurboModule init */
  }
};
const bgEntryStart: number = (globalThis as any).__ONEKEY_BG_ENTRY_START__;
bgEntryLog(`polyfills loaded (+${Date.now() - bgEntryStart}ms)`);

// Android background-runtime `process.nextTick` fix.
//
// The npm `process` polyfill drives its private nextTick queue via a
// `setTimeout` it caches at module-load time. On the Android background JS
// runtime that load precedes RN wiring up timers, so the first
// `runTimeout(drainQueue)` fails and the queue never drains again — verified on
// device: the queue grows monotonically and drainQueue never runs, while
// setTimeout / setImmediate / queueMicrotask / Promise.then all work. Any code
// relying on `process.nextTick` to deliver a result then hangs forever — e.g.
// npm `pbkdf2`'s async callback used by cardano-crypto.js `mnemonicToRootKeypair`,
// which made software-wallet Cardano address creation load forever on Android
// (iOS / hardware wallet were unaffected: hardware derives on-device, and the
// iOS background runtime drains nextTick normally).
//
// Redirect `process.nextTick` to the verified-working `setImmediate`. Scoped to
// Android, applied here in the background-thread entry (so the main thread is
// untouched), and only when a `process.nextTick` exists — done right after the
// polyfill loads and before anything uses nextTick, so the broken queue is
// never used.
function applyAndroidBgNextTickFix() {
  const { Platform } = require('react-native') as typeof import('react-native');
  const g = globalThis as unknown as {
    process?: {
      nextTick?: (
        callback: (...args: unknown[]) => void,
        ...args: unknown[]
      ) => void;
    };
    setImmediate?: (callback: () => void) => void;
  };
  const proc = g.process;
  const setImmediateFn = g.setImmediate;
  if (
    Platform.OS !== 'android' ||
    !proc ||
    typeof proc.nextTick !== 'function' ||
    typeof setImmediateFn !== 'function'
  ) {
    return;
  }
  proc.nextTick = function nextTickViaSetImmediate(
    callback: (...args: unknown[]) => void,
    ...args: unknown[]
  ) {
    setImmediateFn(() => {
      callback(...args);
    });
  };
  bgEntryLog('process.nextTick -> setImmediate (android background runtime)');
}
applyAndroidBgNextTickFix();

// Install production split bundle loader for background runtime (Phase 3).
// Uses BackgroundThread.loadSegmentInBackground to register segments
// with the background Hermes runtime.
if (!__DEV__) {
  const segLoaderStart = Date.now();
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
  bgEntryLog(
    `segment loader installed in ${Date.now() - segLoaderStart}ms (+${Date.now() - bgEntryStart}ms)`,
  );
}

const apiProxyStart = Date.now();
bgEntryLog(`importing backgroundApiProxy (+${apiProxyStart - bgEntryStart}ms)`);
const backgroundApiProxy: typeof import('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default =
  require('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default;

bgEntryLog(
  `backgroundApiProxy ready in ${Date.now() - apiProxyStart}ms (+${Date.now() - bgEntryStart}ms)`,
);

const rpcHandlerStart = Date.now();
bgEntryLog(`importing RPC handler (+${rpcHandlerStart - bgEntryStart}ms)`);
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

const bgEntryEnd = Date.now();
const entryElapsed = bgEntryEnd - bgEntryStart;
bgEntryLog(
  `entry JS executed in ${entryElapsed}ms (polyfills→apiProxy: ${apiProxyStart - bgEntryStart}ms, apiProxy import: ${Date.now() - apiProxyStart > entryElapsed ? entryElapsed : rpcHandlerStart - apiProxyStart}ms, rpcHandler: ${bgEntryEnd - rpcHandlerStart}ms)`,
);
