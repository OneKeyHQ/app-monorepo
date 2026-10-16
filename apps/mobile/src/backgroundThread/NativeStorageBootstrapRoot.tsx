import { useState, useSyncExternalStore } from 'react';
import type { ComponentType, ReactNode } from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { registerSwrCacheMutationInvalidation } from '@onekeyhq/kit/src/utils/swrCacheMutationInvalidation';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppRestartMode,
  appRestart,
} from '@onekeyhq/shared/src/modules3rdParty/appRestart';
import { callNativeStorage } from '@onekeyhq/shared/src/storage/nativeStorageBridge';
import {
  dismissNativeStorageRecovery,
  getRequestedNativeStorageRecovery,
  getRequestedNativeStorageRecoveryTestSessionId,
  subscribeNativeStorageRecovery,
} from '@onekeyhq/shared/src/storage/nativeStorageRecovery';
import type { INativeStorageRecoveryTestRequest } from '@onekeyhq/shared/src/storage/nativeStorageRecoveryTestTypes';
import { getNativeStorageMigrationRecoveryTarget } from '@onekeyhq/shared/src/storage/nativeStorageTypes';
import type {
  INativeAppStorageRepairSummary,
  INativeStorageMigrationRecoveryTarget,
} from '@onekeyhq/shared/src/storage/nativeStorageTypes';

import {
  bootstrapNativeStorage,
  hydrateColdStartSnapshotAfterRuntimeLaunch,
  waitForColdStartCriticalImagesBeforeMount,
} from './bootstrapNativeStorage';
import { runJotaiMainHydration } from './jotaiMainHydrationGate';
import { hideNativeStorageBootstrapSplash } from './nativeStorageBootstrapSplash';

let AppComponent: ComponentType | undefined;
let bootstrapError: Error | undefined;
let bootstrapErrorTitle = 'Storage initialization failed';
let bootstrapRecoveryTarget: INativeStorageMigrationRecoveryTarget | undefined;
let bootstrapPromise: Promise<void> | undefined;
let storageRepairPromise: Promise<void> | undefined;
let recoveryRestartPromise: Promise<void> | undefined;
let storageRepairInProgress = false;
let storageRepairCompleted = false;
let storageRepairCanReset = false;
let storageRepairError: string | undefined;
let storageRepairSummary: INativeAppStorageRepairSummary | undefined;
let bootstrapGeneration = 0;
type IBootstrapFailureStage = 'app' | 'jotai' | 'runtime-launch' | 'storage';
let bootstrapFailureStage: IBootstrapFailureStage | undefined;
const subscribers = new Set<() => void>();
// Bumped on every notify so the root can detect a notify that fired between
// its render and its subscription (the gate can settle in that window).
let bootstrapStateVersion = 0;
const NATIVE_STORAGE_BOOTSTRAP_TIMEOUT_MS = 65_000;
const NATIVE_STORAGE_BOOTSTRAP_TIMEOUT_MESSAGE =
  'Native storage bootstrap timed out after 65 seconds';

function notifySubscribers() {
  bootstrapStateVersion += 1;
  subscribers.forEach((subscriber) => subscriber());
}

function subscribeBootstrapState(subscriber: () => void) {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

function getBootstrapStateVersion() {
  return bootstrapStateVersion;
}

function initializeJotaiFromBackground() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: backgroundApiProxy } =
    require('@onekeyhq/kit/src/background/instance/backgroundApiProxy') as typeof import('@onekeyhq/kit/src/background/instance/backgroundApiProxy');
  return runJotaiMainHydration(() =>
    backgroundApiProxy.initializeJotaiFromBackground(),
  );
}

function callStorageRecoveryTest(request: INativeStorageRecoveryTestRequest) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: backgroundApiProxy } =
    require('@onekeyhq/kit/src/background/instance/backgroundApiProxy') as typeof import('@onekeyhq/kit/src/background/instance/backgroundApiProxy');
  return backgroundApiProxy.serviceDevSetting.nativeStorageRecoveryTest(
    request,
  );
}

async function releaseStorageRecoveryTestFault() {
  const sessionId = getRequestedNativeStorageRecoveryTestSessionId();
  if (!sessionId || storageRepairInProgress) return;
  storageRepairInProgress = true;
  notifySubscribers();
  try {
    await callStorageRecoveryTest({ action: 'releaseFault', sessionId });
    storageRepairError = 'Simulated fault cleared. Retry repair to continue.';
  } catch {
    storageRepairError =
      'Could not clear the simulated fault. Reopen the test panel.';
  } finally {
    storageRepairInProgress = false;
    notifySubscribers();
  }
}

/** Each stage of the gate that holds the first frame, so a startup
 *  regression can be attributed to one of them instead of the whole wait. */
function logBootstrapStage(stage: string, startedAt: number) {
  try {
    const { NativeLogger, LogLevel } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
    const mainEntryStartedAt = (
      globalThis as unknown as { __ONEKEY_MAIN_ENTRY_START__?: number }
    ).__ONEKEY_MAIN_ENTRY_START__;
    NativeLogger.write(
      LogLevel.Info,
      `[StartupTiming] gate stage ${stage} took ${Date.now() - startedAt}ms (+${
        Date.now() - (mainEntryStartedAt ?? Date.now())
      }ms)`,
    );
  } catch {
    // Logging is best-effort during bootstrap.
  }
}

function withNativeBootstrapTimeout(promise: Promise<boolean>) {
  return new Promise<boolean>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(NATIVE_STORAGE_BOOTSTRAP_TIMEOUT_MESSAGE));
    }, NATIVE_STORAGE_BOOTSTRAP_TIMEOUT_MS);

    void promise.then(
      (shouldMountApp) => {
        clearTimeout(timer);
        resolve(shouldMountApp);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const BACKGROUND_RECONCILIATION_RETRY_DELAYS_MS = [1000, 3000, 10_000];

/**
 * The half of startup that needs bg, once it no longer holds the first frame.
 *
 * Both steps still matter after the mount: the mirrors are how this runtime's
 * writes reach the settings store, and the RPC hydration is canonical — it
 * carries anything bg changed while it was booting. Failing them silently
 * would leave writes queued forever, so they retry and then say so.
 */
function startBackgroundRuntimeReconciliation({
  force,
  generation,
}: {
  force: boolean;
  generation: number;
}) {
  void (async () => {
    for (let attempt = 0; ; attempt += 1) {
      if (generation !== bootstrapGeneration) {
        return;
      }
      const startedAt = Date.now();
      try {
        await bootstrapNativeStorage({ force: force && attempt === 0 });
        if (generation !== bootstrapGeneration) {
          return;
        }
        await initializeJotaiFromBackground();
        logBootstrapStage('background runtime reconciled', startedAt);
        return;
      } catch (error) {
        const delayMs = BACKGROUND_RECONCILIATION_RETRY_DELAYS_MS[attempt];
        writeBootstrapError(
          `[StartupTiming] background runtime reconciliation failed (attempt ${
            attempt + 1
          }): ${error instanceof Error ? error.message : String(error)}${
            delayMs === undefined ? '; giving up' : `; retrying in ${delayMs}ms`
          }`,
        );
        if (delayMs === undefined) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  })();
}

function writeBootstrapError(
  message: string,
  level: 'info' | 'error' = 'error',
) {
  try {
    const { NativeLogger, LogLevel } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
    NativeLogger.write(
      level === 'error' ? LogLevel.Error : LogLevel.Info,
      message,
    );
  } catch {
    // Logging is best-effort during bootstrap.
  }
}

/**
 * Native cold-start gate.
 *
 * Native main and bg are isolated JS runtimes that start concurrently. The
 * business App must not mount until this runtime holds the state it renders
 * from — but that state is now readable here: settings, the cold-start cache
 * and the Jotai store are MMKV files this runtime opens itself.
 *
 * So the gate has two shapes. When the Jotai store hydrates from its file,
 * nothing here waits for bg: the mirrors and the canonical RPC hydration
 * reconcile behind the first frame. When it cannot — Travel Mode, a store
 * still on AsyncStorage, an empty store — the old order stands and bg gates
 * the mount, because then bg is the only one who knows.
 *
 * Whichever shape it takes, the Travel Mode runtime launch is acknowledged
 * first: every synchronous read is masked until it is, so a cache read placed
 * above it silently finds nothing (OK-61505).
 */
function startBootstrap(force = false) {
  if (!force && bootstrapPromise) {
    return bootstrapPromise;
  }
  const generation = (bootstrapGeneration += 1);
  bootstrapError = undefined;
  bootstrapFailureStage = undefined;
  bootstrapRecoveryTarget = undefined;
  notifySubscribers();
  let stage: IBootstrapFailureStage = 'runtime-launch';
  const bootstrapWork = (async () => {
    const { travelModeManager } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@onekeyhq/shared/src/travelMode') as typeof import('@onekeyhq/shared/src/travelMode');
    const { completeTravelModeRuntimeLaunchAcknowledgement } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@onekeyhq/shared/src/travelMode/runtimeLaunchAcknowledgement') as typeof import('@onekeyhq/shared/src/travelMode/runtimeLaunchAcknowledgement');
    const runtimeLaunchStartedAt = Date.now();
    const runtimeLaunchAcknowledged =
      await completeTravelModeRuntimeLaunchAcknowledgement(travelModeManager);
    logBootstrapStage('travel mode runtime launch', runtimeLaunchStartedAt);
    if (!runtimeLaunchAcknowledged) {
      throw new OneKeyLocalError('Unknown error');
    }
    if (generation !== bootstrapGeneration) {
      return false;
    }
    hydrateColdStartSnapshotAfterRuntimeLaunch();

    stage = 'jotai';
    const jotaiStartedAt = Date.now();
    const { hydrateJotaiFromNativeStorage } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@onekeyhq/kit-bg/src/states/jotai/jotaiInitFromNativeStorage') as typeof import('@onekeyhq/kit-bg/src/states/jotai/jotaiInitFromNativeStorage');
    const fastHydration = await hydrateJotaiFromNativeStorage();
    logBootstrapStage(
      fastHydration.hydrated
        ? `jotai from its own file (${fastHydration.atomCount} atoms)`
        : `jotai file hydration skipped (${fastHydration.reason ?? 'unknown'})`,
      jotaiStartedAt,
    );
    if (generation !== bootstrapGeneration) {
      return false;
    }

    if (fastHydration.hydrated) {
      // Everything below this line needs bg, and nothing above it does.
      startBackgroundRuntimeReconciliation({ force, generation });
    } else {
      stage = 'storage';
      const storageStartedAt = Date.now();
      await bootstrapNativeStorage({ force });
      logBootstrapStage('storage mirrors', storageStartedAt);
      if (generation !== bootstrapGeneration) {
        return false;
      }
      stage = 'jotai';
      const rpcStartedAt = Date.now();
      await initializeJotaiFromBackground();
      logBootstrapStage('jotai from background', rpcStartedAt);
      if (generation !== bootstrapGeneration) {
        return false;
      }
    }

    // The home header/banner images were started by the snapshot hydration
    // above; give them a bounded chance to land in the memory cache before
    // the first React frame lays them out (OK-61505).
    await waitForColdStartCriticalImagesBeforeMount();
    return generation === bootstrapGeneration;
  })();
  const nextPromise = withNativeBootstrapTimeout(bootstrapWork)
    .then((shouldMountApp) => {
      if (!shouldMountApp || generation !== bootstrapGeneration) return;
      stage = 'app';
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      AppComponent = (require('../../App') as typeof import('../../App'))
        .default;
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
    })
    .catch((error: unknown) => {
      if (generation !== bootstrapGeneration) {
        return;
      }
      bootstrapError =
        error instanceof Error ? error : new Error(String(error));
      bootstrapFailureStage = stage;
      bootstrapRecoveryTarget = getNativeStorageMigrationRecoveryTarget(error);
      if (stage === 'storage') {
        bootstrapErrorTitle = 'Storage initialization failed';
      } else if (stage === 'runtime-launch') {
        bootstrapErrorTitle = 'Runtime launch verification failed';
      } else if (stage === 'jotai') {
        bootstrapErrorTitle = 'State initialization failed';
      } else {
        bootstrapErrorTitle = 'App startup failed';
      }
      bootstrapPromise = undefined;
      hideNativeStorageBootstrapSplash();
    })
    .finally(() => {
      if (generation === bootstrapGeneration) {
        notifySubscribers();
      }
    });
  bootstrapPromise = nextPromise;
  return bootstrapPromise;
}

async function forceDisableTravelModeForRecoveryBestEffort() {
  try {
    const { forceDisableTravelModeForRecovery } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@onekeyhq/shared/src/travelMode/nativeLaunchEpoch') as typeof import('@onekeyhq/shared/src/travelMode/nativeLaunchEpoch');
    return await forceDisableTravelModeForRecovery();
  } catch {
    // A storage recovery action must continue even if this safeguard fails.
    return false;
  }
}

async function retryBootstrapAfterFailure() {
  const didDisableTravelMode =
    await forceDisableTravelModeForRecoveryBestEffort();
  if (didDisableTravelMode) {
    return restartAfterBootstrapFailure({
      failureStage: bootstrapFailureStage ?? 'storage',
      reason: 'storage.bootstrap.retry.travel-mode-disabled',
      travelModeRecoveryCompleted: true,
    });
  }
  return startBootstrap(true);
}

function restartAfterBootstrapFailure({
  failureStage,
  reason,
  travelModeRecoveryCompleted = false,
}: {
  failureStage: IBootstrapFailureStage;
  reason: string;
  travelModeRecoveryCompleted?: boolean;
}) {
  if (recoveryRestartPromise) {
    return recoveryRestartPromise;
  }
  const nextPromise = (async () => {
    if (!travelModeRecoveryCompleted) {
      await forceDisableTravelModeForRecoveryBestEffort();
    }
    await appRestart({
      mode: EAppRestartMode.All,
      reason,
    });
  })()
    .catch((error: unknown) => {
      bootstrapError =
        error instanceof Error ? error : new Error(String(error));
      bootstrapErrorTitle =
        failureStage === 'runtime-launch'
          ? 'Runtime restart failed'
          : 'App restart recovery failed';
      bootstrapFailureStage = failureStage;
      hideNativeStorageBootstrapSplash();
    })
    .finally(() => {
      if (recoveryRestartPromise === nextPromise) {
        recoveryRestartPromise = undefined;
      }
      notifySubscribers();
    });
  recoveryRestartPromise = nextPromise;
  return recoveryRestartPromise;
}

function startStorageRepair(
  target: INativeStorageMigrationRecoveryTarget,
  action: 'prepare' | 'complete' | 'reset' | 'close' = 'prepare',
  force = false,
) {
  if (storageRepairPromise) {
    return storageRepairPromise;
  }
  // Invalidate the old reconciliation loop before touching the storage owner.
  bootstrapGeneration += 1;
  storageRepairInProgress = true;
  if (action !== 'close') storageRepairCompleted = false;
  storageRepairCanReset = false;
  storageRepairError = undefined;
  notifySubscribers();
  const testSessionId = getRequestedNativeStorageRecoveryTestSessionId();
  writeBootstrapError(
    `[NativeStorageRecovery] target=${target} phase=${action}-start test=${Boolean(testSessionId)}`,
    'info',
  );
  let restartScheduled = false;
  const nextPromise = (async () => {
    if (action === 'close') {
      if (target !== 'appStorage' || !storageRepairCompleted) {
        throw new OneKeyLocalError('Storage repair has not completed');
      }
      // Closing only refreshes the runtimes; storage was already committed.
      await appRestart({
        mode: EAppRestartMode.All,
        reason: testSessionId
          ? 'storage.migration.test.repaired'
          : 'storage.migration.repaired',
      });
      restartScheduled = true;
      return;
    }
    if (target === 'appStorage' && action === 'prepare') {
      storageRepairSummary = undefined;
      const summary = testSessionId
        ? (
            await callStorageRecoveryTest({
              action: 'prepare',
              sessionId: testSessionId,
            })
          ).summary
        : await callNativeStorage<INativeAppStorageRepairSummary | undefined>({
            scope: 'recovery',
            operation: 'prepareMigrationRepair',
            target,
          });
      if (!summary)
        throw new OneKeyLocalError(
          'Storage repair is unavailable in this runtime',
        );
      storageRepairSummary = summary;
      if (summary.failedCount > 0 || !summary.scanComplete) return;
    }
    if (target === 'appStorage') {
      if (!storageRepairSummary)
        throw new OneKeyLocalError('Please run storage repair again');
      if (testSessionId) {
        await callStorageRecoveryTest({
          action: 'complete',
          sessionId: testSessionId,
          repairId: storageRepairSummary.repairId,
          force,
        });
      } else {
        await callNativeStorage<void>({
          scope: 'recovery',
          operation: 'completeMigrationRepair',
          target,
          repairId: storageRepairSummary.repairId,
          force,
        });
      }
    } else if (action === 'reset') {
      await callNativeStorage<void>({
        scope: 'recovery',
        operation: 'resetMigrationTarget',
        target,
      });
    }
    if (testSessionId) {
      const result = await callStorageRecoveryTest({
        action: 'verify',
        sessionId: testSessionId,
      });
      if (!result.snapshot.verification?.passed)
        throw new OneKeyLocalError('Storage recovery test verification failed');
    } else {
      await bootstrapNativeStorage({ force: true });
      await initializeJotaiFromBackground();
    }
    if (target === 'appStorage') {
      if (testSessionId !== getRequestedNativeStorageRecoveryTestSessionId()) {
        throw new OneKeyLocalError(
          'Storage repair request changed. Please retry.',
        );
      }
      storageRepairCompleted = true;
      writeBootstrapError(
        `[NativeStorageRecovery] target=${target} result=verified awaitingClose=true test=${Boolean(testSessionId)}`,
        'info',
      );
      return;
    }
    writeBootstrapError(
      `[NativeStorageRecovery] target=${target} result=verified restarting=true`,
      'info',
    );
    // Both heaps can retain values from the failed store. Restart both only
    // after canonical storage and state hydration have passed verification.
    await appRestart({
      mode: EAppRestartMode.All,
      reason: 'storage.migration.repaired',
    });
    restartScheduled = true;
  })()
    .catch((error: unknown) => {
      storageRepairCanReset =
        target === 'jotai' &&
        action !== 'reset' &&
        getNativeStorageMigrationRecoveryTarget(error) === target;
      if (storageRepairCompleted) {
        storageRepairError =
          'Storage repair is complete, but the app could not restart. Please close and reopen the app.';
      } else {
        storageRepairError = storageRepairCanReset
          ? 'The storage could not be recovered. You can rebuild the affected local storage to continue.'
          : 'Storage repair failed. Please retry or restart the app. See the device log for details.';
      }
      writeBootstrapError(
        `[NativeStorageRecovery] target=${target} result=failed canReset=${storageRepairCanReset} errorType=${error instanceof Error ? error.name : typeof error}`,
      );
      hideNativeStorageBootstrapSplash();
    })
    .finally(() => {
      if (storageRepairPromise === nextPromise) {
        storageRepairPromise = undefined;
      }
      storageRepairInProgress = restartScheduled;
      notifySubscribers();
    });
  storageRepairPromise = nextPromise;
  return storageRepairPromise;
}

void startBootstrap();

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  errorContainer: {
    backgroundColor: '#000',
    flex: 1,
  },
  errorContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  waitingDark: { backgroundColor: '#000' },
  waitingLight: { backgroundColor: '#fff' },
  title: { color: '#fff', fontSize: 18, fontWeight: '600' },
  message: { color: '#aaa', marginTop: 12, textAlign: 'center' },
  retryButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { color: '#000', fontWeight: '600' },
  restartButton: {
    borderColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  restartText: { color: '#fff', fontWeight: '600' },
});

// Registered here, in the module that awaits the background runtime, because
// the wait is what it has to precede: a wallet removal interrupted by a crash
// is completed by bg's startup recovery, which emits its mutation event before
// this module requires `../../App` — and the event bus does not replay to a
// listener that subscribes afterwards. Module scope, so no component has to
// mount first.
registerSwrCacheMutationInvalidation();

let lastRecoveryTestSessionId: string | undefined;
subscribeNativeStorageRecovery(() => {
  const sessionId = getRequestedNativeStorageRecoveryTestSessionId();
  if (sessionId !== lastRecoveryTestSessionId && !storageRepairInProgress) {
    storageRepairSummary = undefined;
    storageRepairCompleted = false;
    storageRepairError = undefined;
    storageRepairCanReset = false;
  }
  lastRecoveryTestSessionId = sessionId;
  notifySubscribers();
});

export function NativeStorageBootstrapRoot() {
  useSyncExternalStore(subscribeBootstrapState, getBootstrapStateVersion);
  const requestedRecoveryTarget = useSyncExternalStore(
    subscribeNativeStorageRecovery,
    getRequestedNativeStorageRecovery,
  );
  const [repairConfirmationTarget, setRepairConfirmationTarget] = useState<
    INativeStorageMigrationRecoveryTarget | undefined
  >();
  const isDarkMode = useColorScheme() === 'dark';

  if (AppComponent && !requestedRecoveryTarget) {
    const App = AppComponent;
    return <App />;
  }
  if (bootstrapError || requestedRecoveryTarget) {
    const recoveryTarget = requestedRecoveryTarget ?? bootstrapRecoveryTarget;
    const testSessionId = getRequestedNativeStorageRecoveryTestSessionId();
    const isConfirmingRepair = repairConfirmationTarget === recoveryTarget;
    const isRepairCompleted =
      recoveryTarget === 'appStorage' && storageRepairCompleted;
    let recoveryTitle = bootstrapErrorTitle;
    if (recoveryTarget) {
      recoveryTitle = isRepairCompleted
        ? 'Storage repair complete'
        : 'Local storage needs repair';
    }
    let recoveryDescription = bootstrapError?.message;
    if (recoveryTarget === 'appStorage') {
      recoveryDescription = isRepairCompleted
        ? 'Repair completed. The original legacy storage has been kept unchanged. Close to restart the app.'
        : 'Repair keeps readable MMKV items and restores missing items from legacy storage, which may be outdated. The original legacy storage will be kept unchanged. Repair finishes automatically when all items succeed.';
    } else if (recoveryTarget === 'jotai') {
      recoveryDescription =
        'Retry loading local preferences. If that fails, you can choose to rebuild the affected preferences. The original legacy storage will be kept unchanged.';
    }
    let recoveryAction: ReactNode;
    if (storageRepairInProgress) {
      recoveryAction = (
        <ActivityIndicator testID="native-storage-repair-progress" />
      );
    } else if (isRepairCompleted) {
      recoveryAction = (
        <Pressable
          accessibilityRole="button"
          onPress={() => void startStorageRepair(recoveryTarget, 'close')}
          style={styles.retryButton}
          testID="native-storage-repair-close"
        >
          <Text style={styles.retryText}>Close</Text>
        </Pressable>
      );
    } else if (!recoveryTarget && bootstrapFailureStage === 'runtime-launch') {
      recoveryAction = (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            void restartAfterBootstrapFailure({
              failureStage: 'runtime-launch',
              reason: 'travel-mode.runtime-launch.restart',
            })
          }
          style={styles.retryButton}
          testID="travel-mode-runtime-launch-retry"
        >
          <Text style={styles.retryText}>Retry and restart</Text>
        </Pressable>
      );
    } else if (!recoveryTarget) {
      recoveryAction = (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => void retryBootstrapAfterFailure()}
            style={styles.retryButton}
            testID="native-storage-migration-retry"
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void restartAfterBootstrapFailure({
                failureStage: bootstrapFailureStage ?? 'storage',
                reason: 'storage.bootstrap.restart',
              })
            }
            style={styles.restartButton}
            testID="native-storage-bootstrap-restart-app"
          >
            <Text style={styles.restartText}>Restart App</Text>
          </Pressable>
        </>
      );
    } else if (isConfirmingRepair) {
      recoveryAction = (
        <>
          <Text style={styles.message}>
            {recoveryTarget === 'appStorage'
              ? 'Only successfully recovered items will be kept in MMKV. Failed or unscanned items may be unavailable. The original legacy storage will be kept unchanged. Force completion?'
              : 'This resets the affected local preferences. The original legacy storage will be kept unchanged. Continue?'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setRepairConfirmationTarget(undefined);
              void startStorageRepair(
                recoveryTarget,
                recoveryTarget === 'appStorage' ? 'complete' : 'reset',
                true,
              );
            }}
            style={styles.retryButton}
            testID="native-storage-migration-repair-confirm"
          >
            <Text style={styles.retryText}>
              {recoveryTarget === 'appStorage'
                ? 'Confirm forced completion'
                : 'Confirm rebuild'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRepairConfirmationTarget(undefined)}
            style={styles.retryButton}
            testID="native-storage-migration-repair-cancel"
          >
            <Text style={styles.retryText}>Cancel</Text>
          </Pressable>
        </>
      );
    } else if (recoveryTarget === 'appStorage' && storageRepairSummary) {
      const requiresForce =
        storageRepairSummary.failedCount > 0 ||
        !storageRepairSummary.scanComplete;
      recoveryAction = (
        <>
          {requiresForce ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setRepairConfirmationTarget(recoveryTarget)}
              style={styles.retryButton}
              testID="native-storage-repair-complete"
            >
              <Text style={styles.retryText}>Force completion</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => void startStorageRepair(recoveryTarget)}
            style={styles.restartButton}
            testID="native-storage-repair-retry"
          >
            <Text style={styles.restartText}>Try repair again</Text>
          </Pressable>
        </>
      );
    } else if (storageRepairCanReset) {
      recoveryAction = (
        <Pressable
          accessibilityRole="button"
          onPress={() => setRepairConfirmationTarget(recoveryTarget)}
          style={styles.retryButton}
          testID="native-storage-migration-repair"
        >
          <Text style={styles.retryText}>Rebuild local storage</Text>
        </Pressable>
      );
    } else {
      recoveryAction = (
        <Pressable
          accessibilityRole="button"
          onPress={() => void startStorageRepair(recoveryTarget)}
          style={styles.retryButton}
          testID="native-storage-migration-repair-attempt"
        >
          <Text style={styles.retryText}>Try repair</Text>
        </Pressable>
      );
    }
    return (
      <ScrollView
        style={styles.errorContainer}
        contentContainerStyle={styles.errorContent}
      >
        <Text style={styles.title}>{recoveryTitle}</Text>
        {testSessionId ? (
          <Text
            style={styles.message}
            testID="native-storage-recovery-test-banner"
          >
            Isolated storage recovery test. Wallet storage is not part of this
            scenario. After closing, reopen the developer test panel to verify
            the result.
          </Text>
        ) : null}
        <Text style={styles.message}>{recoveryDescription}</Text>
        {recoveryTarget === 'appStorage' && storageRepairSummary ? (
          <>
            <Text style={styles.message}>
              {`Successful: ${storageRepairSummary.successfulCount}. Failed: ${storageRepairSummary.failedCount}. Kept from MMKV: ${storageRepairSummary.preservedCount}. Restored from legacy storage: ${storageRepairSummary.recoveredCount}.`}
            </Text>
            {!storageRepairSummary.scanComplete ? (
              <Text style={styles.message}>
                Some storage could not be scanned. These counts cover known
                items only; additional items may be missing.
              </Text>
            ) : null}
          </>
        ) : null}
        {storageRepairError ? (
          <Text style={styles.message}>{storageRepairError}</Text>
        ) : null}
        {recoveryAction}
        {testSessionId &&
        storageRepairError &&
        !storageRepairInProgress &&
        !isRepairCompleted ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void releaseStorageRecoveryTestFault()}
            style={styles.restartButton}
            testID="native-storage-recovery-test-release-fault"
          >
            <Text style={styles.restartText}>Clear simulated fault</Text>
          </Pressable>
        ) : null}
        {AppComponent && !storageRepairInProgress && !isRepairCompleted ? (
          <Pressable
            accessibilityRole="button"
            style={styles.restartButton}
            testID="native-storage-repair-back"
            onPress={() => {
              storageRepairError = undefined;
              storageRepairCanReset = false;
              dismissNativeStorageRecovery();
            }}
          >
            <Text style={styles.restartText}>Back</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    );
  }
  return (
    <View
      style={[
        styles.container,
        isDarkMode ? styles.waitingDark : styles.waitingLight,
      ]}
      testID="native-storage-bootstrap-waiting"
    >
      <ActivityIndicator
        color={isDarkMode ? '#fff' : '#000'}
        testID="native-storage-bootstrap-spinner"
      />
    </View>
  );
}
