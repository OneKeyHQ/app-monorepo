/* eslint-disable import-js/order, @typescript-eslint/no-require-imports */

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
if (!__DEV__) {
  try {
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
  } catch {
    // Split bundle loader not available — async imports will use default behavior
  }
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
