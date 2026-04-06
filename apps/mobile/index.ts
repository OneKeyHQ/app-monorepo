/* eslint-disable import-js/order, @typescript-eslint/no-require-imports */

// Track JS entry execution start time
(globalThis as any).__ONEKEY_MAIN_ENTRY_START__ = Date.now();

type IExpoModule = typeof import('expo');
type IReactNativeDeviceUtilsModule =
  typeof import('@onekeyfe/react-native-device-utils');
type ISentryModule =
  typeof import('@onekeyhq/shared/src/modules3rdParty/sentry');
type IAppModule = typeof import('./App');

(
  globalThis as typeof globalThis & {
    __ONEKEY_RUNTIME_KIND__?: 'main' | 'background';
  }
).__ONEKEY_RUNTIME_KIND__ = 'main';

require('@onekeyhq/shared/src/performance/init');
require('./jsReady');
require('@onekeyhq/shared/src/polyfills');

// Install production split bundle loader before any async imports execute.
// In dev mode __SEGMENT_MANIFEST__ is undefined so this is a no-op.
// In production, if the native module fails to load, we crash early (#37)
// rather than letting async imports silently fail with stale dev-server URLs.
if (!__DEV__) {
  const { getSegmentManifest } =
    require('./src/splitBundle/segmentManifest') as typeof import('./src/splitBundle/segmentManifest');
  const manifest = getSegmentManifest();
  if (Object.keys(manifest.segments).length > 0) {
    const { installProdBundleLoader } =
      require('./src/splitBundle/installProdBundleLoader') as typeof import('./src/splitBundle/installProdBundleLoader');
    const { getNativeSplitBundleLoader } =
      require('./src/splitBundle/nativeBridge') as typeof import('./src/splitBundle/nativeBridge');
    installProdBundleLoader(getNativeSplitBundleLoader());
  }
}

// Install native error logger for Release mode debugging.
// ErrorUtils is React Native's global error handler — catches both
// sync exceptions and unhandled promise rejections.
if (!__DEV__) {
  const { NativeLogger, LogLevel } =
    require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
  const origHandler = (globalThis as any).ErrorUtils?.getGlobalHandler?.();
  (globalThis as any).ErrorUtils?.setGlobalHandler?.(
    (error: Error, isFatal: boolean) => {
      NativeLogger.write(
        LogLevel.Error,
        `[JSError] ${isFatal ? 'FATAL' : 'ERROR'}: ${error?.message || error}\n${error?.stack?.slice(0, 500) || ''}`,
      );
      origHandler?.(error, isFatal);
    },
  );
}

require('./src/backgroundThread/setupMainThreadBackgroundRunner');

const { I18nManager } =
  require('react-native') as typeof import('react-native');
const { registerRootComponent } = require('expo') as IExpoModule;
const { initSentry } =
  require('@onekeyhq/shared/src/modules3rdParty/sentry') as ISentryModule;
const { ReactNativeDeviceUtils } =
  require('@onekeyfe/react-native-device-utils') as IReactNativeDeviceUtilsModule;
const App = (require('./App') as IAppModule).default;

ReactNativeDeviceUtils.initEventListeners();
initSentry();
I18nManager.allowRTL(true);

if (typeof globalThis.nativePerformanceNow === 'function') {
  globalThis.$$onekeyAppWillMountFromPerformanceNow =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    globalThis.nativePerformanceNow();
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(
      'onekeyAppWillMountFromPerformanceNow',
      (globalThis.$$onekeyAppWillMountFromPerformanceNow || 0) -
        (globalThis.$$onekeyJsReadyFromPerformanceNow || 0),
    );
  }
}
registerRootComponent(App);

const entryElapsed =
  Date.now() - ((globalThis as any).__ONEKEY_MAIN_ENTRY_START__ || Date.now());
// eslint-disable-next-line no-console
console.log(`[SplitBundle] main entry JS executed in ${entryElapsed}ms`);
