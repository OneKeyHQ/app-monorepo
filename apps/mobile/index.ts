/* eslint-disable import-js/order, @typescript-eslint/no-require-imports */

// Track JS entry execution start time
(globalThis as any).__ONEKEY_MAIN_ENTRY_START__ = Date.now();

type IExpoModule = typeof import('expo');
type IReactNativeDeviceUtilsModule =
  typeof import('@onekeyfe/react-native-device-utils');
type ISentryModule =
  typeof import('@onekeyhq/shared/src/modules3rdParty/sentry');
type INativeStorageContractViolationModule =
  typeof import('@onekeyhq/shared/src/storage/nativeStorageContractViolation');
type IAppModule = typeof import('./App');

(
  globalThis as typeof globalThis & {
    __ONEKEY_RUNTIME_KIND__?: 'main' | 'background';
  }
).__ONEKEY_RUNTIME_KIND__ = 'main';

// ── DIAGNOSTIC BRANCH ONLY: never merge ─────────────────────────────────────
// Counters for the main-runtime GC investigation. Installed before anything
// else loads, so the React renderer finds the hook when it initializes and
// every WeakMap / WeakRef / timer user goes through the counting wrappers.
// The collector reads `__ONEKEY_DIAG_CENSUS__` once per census window.
(() => {
  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/unbound-method, no-extend-native, func-names */
  const g = globalThis as any;
  const census = {
    commits: 0,
    unmounts: 0,
    roots: new Set<any>(),
    onCommit: undefined as undefined | ((root: any) => void),
    weakMapSets: 0,
    weakMapNewKeys: 0,
    weakSetAdds: 0,
    weakRefs: 0,
    finalizers: 0,
    intervalsLive: new Set<any>(),
    intervalsCreated: 0,
    timeoutsScheduled: 0,
  };
  g.__ONEKEY_DIAG_CENSUS__ = census;

  // The production renderer reports every commit to this hook when it exists
  // at the time the renderer module is evaluated; each call is wrapped in a
  // try/catch on React's side.
  if (!g.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    g.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      isDisabled: false,
      renderers: new Map(),
      inject: () => 1,
      onCommitFiberRoot: (_rendererId: number, root: any) => {
        census.commits += 1;
        census.roots.add(root);
        census.onCommit?.(root);
      },
      onCommitFiberUnmount: () => {
        census.unmounts += 1;
      },
      onPostCommitFiberRoot: () => undefined,
      onScheduleFiberRoot: () => undefined,
      checkDCE: () => undefined,
      on: () => undefined,
      off: () => undefined,
      emit: () => undefined,
      sub: () => () => undefined,
    };
  }

  const weakMapSet = WeakMap.prototype.set;
  const weakMapHas = WeakMap.prototype.has;
  WeakMap.prototype.set = function (key: object, value: unknown) {
    census.weakMapSets += 1;
    if (!weakMapHas.call(this, key)) {
      census.weakMapNewKeys += 1;
    }
    return weakMapSet.call(this, key, value);
  };
  const weakSetAdd = WeakSet.prototype.add;
  WeakSet.prototype.add = function (value: object) {
    census.weakSetAdds += 1;
    return weakSetAdd.call(this, value);
  };
  const NativeWeakRef = g.WeakRef;
  if (typeof NativeWeakRef === 'function') {
    const CountingWeakRef = function (this: unknown, target: object) {
      census.weakRefs += 1;
      return Reflect.construct(
        NativeWeakRef,
        [target],
        new.target || CountingWeakRef,
      );
    };
    CountingWeakRef.prototype = NativeWeakRef.prototype;
    g.WeakRef = CountingWeakRef;
  }
  const NativeFinalizationRegistry = g.FinalizationRegistry;
  if (typeof NativeFinalizationRegistry === 'function') {
    const register = NativeFinalizationRegistry.prototype.register;
    NativeFinalizationRegistry.prototype.register = function (
      ...args: unknown[]
    ) {
      census.finalizers += 1;
      return register.apply(this, args);
    };
  }

  const nativeSetInterval = g.setInterval;
  const nativeClearInterval = g.clearInterval;
  const nativeSetTimeout = g.setTimeout;
  if (
    typeof nativeSetInterval === 'function' &&
    typeof nativeClearInterval === 'function' &&
    typeof nativeSetTimeout === 'function'
  ) {
    g.setInterval = (...args: unknown[]) => {
      const id = nativeSetInterval(...args);
      census.intervalsCreated += 1;
      census.intervalsLive.add(id);
      return id;
    };
    g.clearInterval = (id: unknown) => {
      census.intervalsLive.delete(id);
      return nativeClearInterval(id);
    };
    g.setTimeout = (...args: unknown[]) => {
      census.timeoutsScheduled += 1;
      return nativeSetTimeout(...args);
    };
  }
  /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/unbound-method, no-extend-native, func-names */
})();

require('@onekeyhq/shared/src/polyfills');
const { markRuntimePolyfillsReady } =
  require('@onekeyhq/shared/src/polyfills/runtimeCapabilities') as typeof import('@onekeyhq/shared/src/polyfills/runtimeCapabilities');
markRuntimePolyfillsReady();

// ── On-device Storybook workbench: independent top-level entry ──
//
// Registered before the wallet bootstrap in the else branch so a wallet-init
// failure can never block the workbench, and none of the wallet's startup
// side effects run in this mode: no MMKV cold-start pre-read, no background
// transport, no device event listeners, no Sentry, no split-bundle loader or
// error-logger install. Only the shared polyfills and the RTL flag are
// mirrored so components render under the same runtime assumptions as the
// app. The withStorybook Metro wrapper stubs the Storybook config dir out of
// normal bundles (STORYBOOK_ENABLED unset), so this branch adds nothing to
// production. Main runtime only; the background runtime is never started.
if (process.env.STORYBOOK_ENABLED === 'true') {
  const { I18nManager } =
    require('react-native') as typeof import('react-native');
  I18nManager.allowRTL(true);
  const { registerRootComponent } = require('expo') as IExpoModule;
  registerRootComponent((require('./.rnstorybook') as IAppModule).default);
} else {
  const { preventNativeStorageBootstrapSplashAutoHide } =
    require('./src/backgroundThread/nativeStorageBootstrapSplash') as typeof import('./src/backgroundThread/nativeStorageBootstrapSplash');
  preventNativeStorageBootstrapSplashAutoHide();

  // Startup profiler — gated by `ONEKEY_STARTUP_PROFILE=1` at build time.
  // When OFF this is a single `if (enabled) return;` check with no observable
  // overhead. When ON it monkey-patches Metro's `__r` so every module's factory
  // is timed; results are flushed after `main entry evaluated`.
  // See `.skillshare/skills/1k-startup-profile/SKILL.md` for how to enable.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  require('./src/startupProfile').installStartupProfileJs();

  require('@onekeyhq/shared/src/performance/init');
  require('./jsReady');

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

  // Install native error logger for Release mode debugging.
  // ErrorUtils is React Native's global error handler — catches both
  // sync exceptions and unhandled promise rejections.
  //
  // NOTE on Sentry tagging: do NOT call Sentry.setTag(...) from inside this
  // handler. @sentry/react-native's ReactNativeErrorHandlers integration
  // wraps ErrorUtils.setGlobalHandler such that Sentry captures the event
  // BEFORE invoking our wrapped handler — so setTag here would (a) miss the
  // actual crash event and (b) leak onto the next unrelated event via global
  // scope. We tag via a Sentry event processor instead; see
  // installSplitBundleSentryEventProcessor below.
  if (!__DEV__) {
    const { NativeLogger, LogLevel } =
      require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
    const { classifyUnknownModuleError } =
      require('./src/splitBundle/unknownModuleHandler') as typeof import('./src/splitBundle/unknownModuleHandler');
    const platformEnv =
      require('@onekeyhq/shared/src/platformEnv') as typeof import('@onekeyhq/shared/src/platformEnv');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const origHandler = (globalThis as any).ErrorUtils?.getGlobalHandler?.();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    (globalThis as any).ErrorUtils?.setGlobalHandler?.(
      (error: Error, isFatal: boolean) => {
        // Classify "Requiring unknown module <id>" errors before the default
        // handler runs. RN's ExceptionsManager.reportException re-throws while
        // reporting (`TypeError: Failed to execute 'dispatchEvent'`), which
        // masks the original error in Sentry. The NativeLogger breadcrumb
        // here gives us an on-device, Sentry-independent record of the
        // moduleId; the Sentry event processor (see below) attaches the
        // matching tags to the actual crash event.
        // See REACT-NATIVE-4AX.
        const classification = classifyUnknownModuleError(error);
        if (classification) {
          try {
            const bundleVersion =
              platformEnv.default?.bundleVersion ?? 'unknown';
            NativeLogger.write(
              LogLevel.Error,
              `[SplitBundle][BUG] split_bundle_integrity moduleId=${classification.moduleId} bundleVersion=${bundleVersion}`,
            );
          } catch {
            /* never let logging break the handler */
          }
        }
        NativeLogger.write(
          LogLevel.Error,
          `[JSError] ${isFatal ? 'FATAL' : 'ERROR'}: ${error?.message || error}\n${error?.stack?.slice(0, 500) || ''}`,
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        origHandler?.(error, isFatal);
      },
    );
  }

  const nativeStorageContractViolation =
    require('@onekeyhq/shared/src/storage/nativeStorageContractViolation') as INativeStorageContractViolationModule;
  nativeStorageContractViolation.installNativeStorageContractViolationMainHandler();

  const _transportStart = Date.now();
  require('./src/backgroundThread/setupMainThreadBackgroundRunner');

  const { I18nManager } =
    require('react-native') as typeof import('react-native');
  const { registerRootComponent } = require('expo') as IExpoModule;
  const { initSentry } =
    require('@onekeyhq/shared/src/modules3rdParty/sentry') as ISentryModule;
  const { ReactNativeDeviceUtils } =
    require('@onekeyfe/react-native-device-utils') as IReactNativeDeviceUtilsModule;
  const { NativeStorageBootstrapRoot } =
    require('./src/backgroundThread/NativeStorageBootstrapRoot') as typeof import('./src/backgroundThread/NativeStorageBootstrapRoot');

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
  nativeStorageContractViolation.markNativeStorageContractViolationSentryReady();

  // Install Sentry event processor that tags split-bundle integrity crashes.
  // Must run AFTER initSentry() so the SDK's isolation scope is up. See
  // apps/mobile/src/splitBundle/sentryEventProcessor.ts for why this lives
  // in a processor instead of a global error handler.
  if (!__DEV__) {
    try {
      const Sentry =
        require('@onekeyhq/shared/src/modules3rdParty/sentry') as typeof import('@onekeyhq/shared/src/modules3rdParty/sentry');
      const platformEnv =
        require('@onekeyhq/shared/src/platformEnv') as typeof import('@onekeyhq/shared/src/platformEnv');
      const { installSplitBundleSentryEventProcessor } =
        require('./src/splitBundle/sentryEventProcessor') as typeof import('./src/splitBundle/sentryEventProcessor');
      if (typeof Sentry.addEventProcessor === 'function') {
        installSplitBundleSentryEventProcessor({
          // Wrap in an arrow so a future change in @sentry/react-native that
          // makes addEventProcessor a method (depending on `this`) doesn't
          // silently break — the bare reference would lose its receiver here.
          sentry: {
            addEventProcessor: (processor) =>
              Sentry.addEventProcessor(processor),
          },
          getBundleVersion: () => platformEnv.default?.bundleVersion,
        });
      }
    } catch {
      /* never let processor install break startup */
    }
  }

  I18nManager.allowRTL(true);

  registerRootComponent(NativeStorageBootstrapRoot);
}
