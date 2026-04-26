/* eslint-disable import-js/order, @typescript-eslint/no-require-imports */

// Track JS entry execution start time
(globalThis as any).__ONEKEY_MAIN_ENTRY_START__ = Date.now();

// Startup profiler — gated by `ONEKEY_STARTUP_PROFILE=1` at build time.
// When OFF this is a single `if (enabled) return;` check with no observable
// overhead. When ON it monkey-patches Metro's `__r` so every module's factory
// is timed; results are flushed after `main entry evaluated`.
// See `.skillshare/skills/1k-startup-profile/skill.md` for how to enable.
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
require('./src/startupProfile').installStartupProfileJs();

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

// ── Jotai Cold Start SSR — Phase 1: Snapshot Pre-read ──
//
// Pattern analogous to SSR hydration:
//   "Server" = previous session that saved atom values to MMKV
//   "Transfer" = MMKV cold-start cache (synchronous, survives app restart)
//   "Hydration" = hydrateContextColdStartCacheForProvider seeds scoped atoms
//                  on provider mount from the snapshot on globalThis
//   "First Paint" = React renders cached data immediately (no skeleton)
//   "Revalidation" = BG thread fetches fresh data, atoms update in-place
//
// This block pre-reads the snapshot from MMKV into globalThis before any
// module evaluates, so the scoped hydrator can use it as initial atom values.
// Without this, atoms start empty → skeleton → wait for network → ~2s slower.
try {
  const { coldStartCacheStorage: _coldStartCache } =
    require('@onekeyhq/shared/src/storage/instance/syncStorageInstance') as typeof import('@onekeyhq/shared/src/storage/instance/syncStorageInstance');
  const { EAppSyncStorageKeys: _keys } =
    require('@onekeyhq/shared/src/storage/syncStorageKeys') as typeof import('@onekeyhq/shared/src/storage/syncStorageKeys');

  const _ctxRaw = _coldStartCache.getString(
    _keys.onekey_jotai_context_atoms_snapshot,
  );
  if (_ctxRaw) {
    (globalThis as any).__ONEKEY_CTX_ATOM_SNAPSHOT__ = JSON.parse(_ctxRaw);
    const { NativeLogger: _NL, LogLevel: _LL } =
      require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
    _NL.write(
      _LL.Info,
      `[StartupTiming] MMKV contextAtom snapshot pre-read: ${Object.keys((globalThis as any).__ONEKEY_CTX_ATOM_SNAPSHOT__).length} keys (+${Date.now() - (globalThis as any).__ONEKEY_MAIN_ENTRY_START__}ms)`,
    );
  }
} catch {
  /* MMKV not available yet */
}

// Install production split bundle loader before any async imports execute.
// In dev mode __SEGMENT_MANIFEST__ is undefined so this is a no-op.
// In production, if the native module fails to load, we crash early (#37)
// rather than letting async imports silently fail with stale dev-server URLs.
if (!__DEV__) {
  const _segStart = Date.now();
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
  const { NativeLogger: _NL2, LogLevel: _LL2 } =
    require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
  _NL2.write(
    _LL2.Info,
    `[StartupTiming] segment loader installed in ${Date.now() - _segStart}ms (+${Date.now() - (globalThis as any).__ONEKEY_MAIN_ENTRY_START__}ms)`,
  );
}

// Pre-warm critical home page icon segments so they're loaded by first render.
// Must run AFTER segment loader install (line 64) and BEFORE React mount.
if ((globalThis as any).__ONEKEY_CTX_ATOM_SNAPSHOT__) {
  const { warmCriticalIcons } =
    require('@onekeyhq/components/src/primitives/Icon') as typeof import('@onekeyhq/components/src/primitives/Icon');
  warmCriticalIcons();
}

// Install native error logger for Release mode debugging.
// ErrorUtils is React Native's global error handler — catches both
// sync exceptions and unhandled promise rejections.
if (!__DEV__) {
  const { NativeLogger, LogLevel } =
    require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const origHandler = (globalThis as any).ErrorUtils?.getGlobalHandler?.();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  (globalThis as any).ErrorUtils?.setGlobalHandler?.(
    (error: Error, isFatal: boolean) => {
      NativeLogger.write(
        LogLevel.Error,
        `[JSError] ${isFatal ? 'FATAL' : 'ERROR'}: ${error?.message || error}\n${error?.stack?.slice(0, 500) || ''}`,
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      origHandler?.(error, isFatal);
    },
  );
}

const _transportStart = Date.now();
require('./src/backgroundThread/setupMainThreadBackgroundRunner');

const { I18nManager } =
  require('react-native') as typeof import('react-native');
const { registerRootComponent } = require('expo') as IExpoModule;
const { initSentry } =
  require('@onekeyhq/shared/src/modules3rdParty/sentry') as ISentryModule;
const { ReactNativeDeviceUtils } =
  require('@onekeyfe/react-native-device-utils') as IReactNativeDeviceUtilsModule;
const App = (require('./App') as IAppModule).default;

{
  const _e = (globalThis as any).__ONEKEY_MAIN_ENTRY_START__ as number;
  const { NativeLogger: _NL3, LogLevel: _LL3 } =
    require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
  _NL3.write(
    _LL3.Info,
    `[StartupTiming] BG transport setup in ${Date.now() - _transportStart}ms (+${Date.now() - _e}ms)`,
  );
  _NL3.write(
    _LL3.Info,
    `[StartupTiming] main entry evaluated (+${Date.now() - _e}ms)`,
  );
}

// If startup profiling is enabled, schedule a flush now so the
// module-level per-require breakdown ends up right after the line above.
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
require('./src/startupProfile').scheduleStartupProfileJsFlush();

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
