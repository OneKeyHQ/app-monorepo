/* eslint-disable import-js/order, @typescript-eslint/no-require-imports */

// Track JS background entry execution start time
(globalThis as any).__ONEKEY_BG_ENTRY_START__ = Date.now();

(
  globalThis as typeof globalThis & {
    __ONEKEY_RUNTIME_KIND__?: 'main' | 'background';
  }
).__ONEKEY_RUNTIME_KIND__ = 'background';

require('@onekeyhq/shared/src/polyfills');
const { markRuntimePolyfillsReady } =
  require('@onekeyhq/shared/src/polyfills/runtimeCapabilities') as typeof import('@onekeyhq/shared/src/polyfills/runtimeCapabilities');
markRuntimePolyfillsReady();

// Function tracing is compiled in only by the *-function-trace EAS
// profiles. Install it right after the polyfill bootstrap to keep the entry contract.
const startupProfile =
  require('./src/startupProfile') as typeof import('./src/startupProfile');
startupProfile.installFunctionTrace();

const { initSentry } =
  require('@onekeyhq/shared/src/modules3rdParty/sentry') as typeof import('@onekeyhq/shared/src/modules3rdParty/sentry');
initSentry();
const { OneKeyLocalError } =
  require('@onekeyhq/shared/src/errors') as typeof import('@onekeyhq/shared/src/errors');

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

// The Android background-runtime `process.nextTick` replacement is installed
// by packages/shared/src/polyfills/processNextTickShim.ts right after the
// process polyfill, before any module can capture the broken implementation.
// Surface which implementation is active for log forensics.
bgEntryLog(
  `process.nextTick=${
    (globalThis as { process?: { nextTick?: { name?: string } } }).process
      ?.nextTick?.name ?? 'none'
  }`,
);

const rpcHandlerStart = Date.now();
bgEntryLog(`importing RPC handler (+${rpcHandlerStart - bgEntryStart}ms)`);
const {
  reportBackgroundThreadInitializationFailure,
  setBackgroundThreadRequestExecutor,
} =
  require('./src/backgroundThread/setupBackgroundThreadRPCHandler') as typeof import('./src/backgroundThread/setupBackgroundThreadRPCHandler');
const rpcHandlerEnd = Date.now();

const { AppRegistry } =
  require('react-native') as typeof import('react-native');

const BackgroundThreadRoot = () => null;

AppRegistry.registerComponent('background', () => BackgroundThreadRoot);

async function initializeBackgroundRuntime() {
  const storagePreparationStart = Date.now();
  bgEntryLog(
    `preparing native storage (+${storagePreparationStart - bgEntryStart}ms)`,
  );
  const {
    executeNativeStorageRequest,
    prepareNativeStorageForBackgroundStartup,
  } =
    require('@onekeyhq/shared/src/storage/nativeStorageExecutor') as typeof import('@onekeyhq/shared/src/storage/nativeStorageExecutor');
  await prepareNativeStorageForBackgroundStartup();
  bgEntryLog(
    `native storage prepared in ${Date.now() - storagePreparationStart}ms (+${Date.now() - bgEntryStart}ms)`,
  );

  const { travelModeManager } =
    require('@onekeyhq/shared/src/travelMode') as typeof import('@onekeyhq/shared/src/travelMode');
  const { completeTravelModeRuntimeLaunchAcknowledgement } =
    require('@onekeyhq/shared/src/travelMode/runtimeLaunchAcknowledgement') as typeof import('@onekeyhq/shared/src/travelMode/runtimeLaunchAcknowledgement');
  const runtimeLaunchAcknowledgement =
    completeTravelModeRuntimeLaunchAcknowledgement(travelModeManager);
  const { installTravelModeRuntimeLaunchGate } =
    require('@onekeyhq/shared/src/travelMode/runtimeLaunchGate') as typeof import('@onekeyhq/shared/src/travelMode/runtimeLaunchGate');
  if (!installTravelModeRuntimeLaunchGate(runtimeLaunchAcknowledgement)) {
    throw new OneKeyLocalError(
      'Travel Mode runtime launch gate is already installed',
    );
  }

  // Install the split loader only after recovery has finished. Segment imports
  // may construct services that read process-shared native storage.
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

  const { travelModeCommandDispatcher } =
    require('@onekeyhq/kit-bg/src/apis/TravelModeCommandDispatcher') as typeof import('@onekeyhq/kit-bg/src/apis/TravelModeCommandDispatcher');

  let backgroundApiProxyPromise:
    | Promise<
        typeof import('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default
      >
    | undefined;
  const getBackgroundApiProxy = () => {
    backgroundApiProxyPromise ??= runtimeLaunchAcknowledgement.then(
      (acknowledged) => {
        if (!acknowledged) {
          throw new OneKeyLocalError('Unknown error');
        }
        const apiProxyStart = Date.now();
        bgEntryLog(
          `importing backgroundApiProxy (+${apiProxyStart - bgEntryStart}ms)`,
        );
        const backgroundApiProxy: typeof import('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default =
          require('@onekeyhq/kit/src/background/instance/backgroundApiProxy').default;
        bgEntryLog(
          `backgroundApiProxy ready in ${Date.now() - apiProxyStart}ms (+${Date.now() - bgEntryStart}ms)`,
        );
        return backgroundApiProxy;
      },
    );
    return backgroundApiProxyPromise;
  };

  bgEntryLog('registering gated request executor');
  setBackgroundThreadRequestExecutor(async (request) => {
    if (
      request.type === 'service-call' &&
      request.method === 'nativeStorage' &&
      (request.params[0] as { scope?: unknown } | undefined)?.scope ===
        'bootstrap'
    ) {
      return executeNativeStorageRequest(request.params[0]);
    }
    if (request.type === 'service-call') {
      return travelModeCommandDispatcher.runTransportServiceCall({
        method: request.method,
        operation: async () => {
          const backgroundApiProxy = await getBackgroundApiProxy();
          const result: unknown = await backgroundApiProxy.callBackgroundMethod(
            request.sync,
            request.method,
            ...request.params,
          );
          return result;
        },
      });
    }
    if (request.type === 'bridge-call') {
      const backgroundApiProxy = await getBackgroundApiProxy();
      return backgroundApiProxy.bridgeReceiveHandler(request.payload);
    }

    return undefined;
  });

  // Main cannot publish its profile acknowledgement until its storage
  // bootstrap has called this executor. The full BackgroundApi stays unloaded
  // until both runtimes confirm the native epoch and target profile.
  const runtimeLaunchAcknowledged = await runtimeLaunchAcknowledgement;
  if (!runtimeLaunchAcknowledged) {
    bgEntryLog(
      'runtime launch acknowledgement failed; keeping bootstrap-only executor active',
    );
    return;
  }
  await getBackgroundApiProxy();

  const bgEntryEnd = Date.now();
  const entryElapsed = bgEntryEnd - bgEntryStart;
  bgEntryLog(
    `entry JS initialized in ${entryElapsed}ms (polyfills→rpcHandler: ${rpcHandlerStart - bgEntryStart}ms, rpcHandler import: ${rpcHandlerEnd - rpcHandlerStart}ms)`,
  );
}

void initializeBackgroundRuntime().catch((error: unknown) => {
  bgEntryLog(
    `initialization failed: ${error instanceof Error ? error.message : 'unknown error'}`,
  );
  reportBackgroundThreadInitializationFailure(error);
});
