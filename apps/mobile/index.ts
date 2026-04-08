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

// One-time migration: globalAtom snapshot blob → MMKV per-key storage.
// After migration, each globalAtom reads its own MMKV key directly
// (no snapshot blob needed). Context atom snapshot pre-read is unchanged.
function _migrationLog(msg: string) {
  try {
    const { NativeLogger: NL, LogLevel: LL } =
      require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
    NL.write(LL.Info, `[JotaiMigration] ${msg}`);
  } catch {
    /* NativeLogger not available yet */
  }
}
try {
  const { syncStorage: _syncStorage } =
    require('@onekeyhq/shared/src/storage/instance/syncStorageInstance') as typeof import('@onekeyhq/shared/src/storage/instance/syncStorageInstance');
  const { EAppSyncStorageKeys: _keys } =
    require('@onekeyhq/shared/src/storage/syncStorageKeys') as typeof import('@onekeyhq/shared/src/storage/syncStorageKeys');

  // Migrate globalAtom snapshot blob → MMKV per-key (one-time, synchronous)
  const _migrated = _syncStorage.getBoolean(
    _keys.onekey_jotai_mmkv_per_key_migrated,
  );
  if (!_migrated) {
    try {
      const { default: _jotaiMMKV } =
        require('@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance') as typeof import('@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance');
      const { buildJotaiStorageKey } =
        require('@onekeyhq/kit-bg/src/states/jotai/jotaiStorage') as typeof import('@onekeyhq/kit-bg/src/states/jotai/jotaiStorage');
      const { EAtomNames } =
        require('@onekeyhq/kit-bg/src/states/jotai/atomNames') as typeof import('@onekeyhq/kit-bg/src/states/jotai/atomNames');

      const _raw = _syncStorage.getString(_keys.onekey_jotai_atoms_snapshot);
      if (_raw) {
        const _snapshot = JSON.parse(_raw) as Record<string, any>;
        let _count = 0;
        for (const _atomName of Object.values(EAtomNames)) {
          if (_atomName in _snapshot) {
            const _storageKey = buildJotaiStorageKey(
              _atomName as keyof typeof EAtomNames,
            );
            _jotaiMMKV.set(_storageKey, JSON.stringify(_snapshot[_atomName]));
            _count += 1;
          }
        }
        _migrationLog(
          `snapshot → MMKV per-key OK: ${_count} atoms migrated (+${Date.now() - (globalThis as any).__ONEKEY_MAIN_ENTRY_START__}ms)`,
        );
      } else {
        _migrationLog('no snapshot blob found, skip migration (first install)');
      }
      // Flag ONLY after all writes succeed
      _syncStorage.set(_keys.onekey_jotai_mmkv_per_key_migrated, true);
    } catch (e) {
      // Migration failed — don't set flag, retry next launch.
      // getItem fallback to AsyncStorage ensures data is not lost.
      _migrationLog(
        `migration FAILED, will retry next launch: ${(e as Error)?.message}`,
      );
    }
  }

  // Pre-read context atom snapshot (separate system, unchanged)
  const _ctxRaw = _syncStorage.getString(
    _keys.onekey_jotai_context_atoms_snapshot,
  );
  if (_ctxRaw) {
    (globalThis as any).__ONEKEY_CTX_ATOM_SNAPSHOT__ = JSON.parse(_ctxRaw);
    // eslint-disable-next-line no-console
    console.log(
      `[StartupTiming] MMKV contextAtom snapshot pre-read: ${Object.keys((globalThis as any).__ONEKEY_CTX_ATOM_SNAPSHOT__).length} keys (+${Date.now() - (globalThis as any).__ONEKEY_MAIN_ENTRY_START__}ms)`,
    );
  }
} catch {
  /* MMKV not available yet */
}

const __entryStart: number = (globalThis as any).__ONEKEY_MAIN_ENTRY_START__;

// Install production split bundle loader before any async imports execute.
// In dev mode __SEGMENT_MANIFEST__ is undefined so this is a no-op.
// In production, if the native module fails to load, we crash early (#37)
// rather than letting async imports silently fail with stale dev-server URLs.
if (!__DEV__) {
  const segLoaderStart = Date.now();
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
  // eslint-disable-next-line no-console
  console.log(
    `[StartupTiming] segment loader installed in ${Date.now() - segLoaderStart}ms (+${Date.now() - __entryStart}ms)`,
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

const transportStart = Date.now();
require('./src/backgroundThread/setupMainThreadBackgroundRunner');
// eslint-disable-next-line no-console
console.log(
  `[StartupTiming] setupMainThreadBackgroundRunner in ${Date.now() - transportStart}ms (+${Date.now() - __entryStart}ms)`,
);

const importsStart = Date.now();
const { I18nManager } =
  require('react-native') as typeof import('react-native');
const { registerRootComponent } = require('expo') as IExpoModule;
const { initSentry } =
  require('@onekeyhq/shared/src/modules3rdParty/sentry') as ISentryModule;
const { ReactNativeDeviceUtils } =
  require('@onekeyfe/react-native-device-utils') as IReactNativeDeviceUtilsModule;
const App = (require('./App') as IAppModule).default;
// eslint-disable-next-line no-console
console.log(
  `[StartupTiming] imports (RN+Expo+Sentry+App) in ${Date.now() - importsStart}ms (+${Date.now() - __entryStart}ms)`,
);

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
