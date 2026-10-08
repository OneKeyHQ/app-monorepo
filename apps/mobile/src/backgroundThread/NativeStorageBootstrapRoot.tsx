import { useState, useSyncExternalStore } from 'react';
import type { ComponentType, ReactNode } from 'react';

import {
  ActivityIndicator,
  Pressable,
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
import { getNativeStorageMigrationRecoveryTarget } from '@onekeyhq/shared/src/storage/nativeStorageTypes';
import type { INativeStorageMigrationRecoveryTarget } from '@onekeyhq/shared/src/storage/nativeStorageTypes';

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

function writeBootstrapError(message: string) {
  try {
    const { NativeLogger, LogLevel } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
    NativeLogger.write(LogLevel.Error, message);
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

function startStorageRepair(target: INativeStorageMigrationRecoveryTarget) {
  if (storageRepairPromise) {
    return storageRepairPromise;
  }
  bootstrapError = undefined;
  bootstrapRecoveryTarget = undefined;
  notifySubscribers();
  const nextPromise = callNativeStorage<void>({
    scope: 'recovery',
    operation: 'resetMigrationTarget',
    target,
  })
    .then(() => startBootstrap(true))
    .catch((error: unknown) => {
      bootstrapError =
        error instanceof Error ? error : new Error(String(error));
      bootstrapErrorTitle = 'Storage repair failed';
      bootstrapRecoveryTarget = getNativeStorageMigrationRecoveryTarget(error);
      hideNativeStorageBootstrapSplash();
    })
    .finally(() => {
      if (storageRepairPromise === nextPromise) {
        storageRepairPromise = undefined;
      }
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

export function NativeStorageBootstrapRoot() {
  useSyncExternalStore(subscribeBootstrapState, getBootstrapStateVersion);
  const [repairConfirmationTarget, setRepairConfirmationTarget] = useState<
    INativeStorageMigrationRecoveryTarget | undefined
  >();
  const isDarkMode = useColorScheme() === 'dark';

  if (AppComponent) {
    const App = AppComponent;
    return <App />;
  }
  if (bootstrapError) {
    const recoveryTarget = bootstrapRecoveryTarget;
    const isConfirmingRepair = repairConfirmationTarget === recoveryTarget;
    let recoveryAction: ReactNode;
    if (!recoveryTarget && bootstrapFailureStage === 'runtime-launch') {
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
            This removes the affected local state and its stale AsyncStorage
            copy. Continue?
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setRepairConfirmationTarget(undefined);
              void startStorageRepair(recoveryTarget);
            }}
            style={styles.retryButton}
            testID="native-storage-migration-repair-confirm"
          >
            <Text style={styles.retryText}>Confirm reset</Text>
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
    } else {
      recoveryAction = (
        <Pressable
          accessibilityRole="button"
          onPress={() => setRepairConfirmationTarget(recoveryTarget)}
          style={styles.retryButton}
          testID="native-storage-migration-repair"
        >
          <Text style={styles.retryText}>Reset local storage</Text>
        </Pressable>
      );
    }
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.title}>
          {recoveryTarget ? 'Local storage needs repair' : bootstrapErrorTitle}
        </Text>
        <Text style={styles.message}>
          {recoveryTarget
            ? 'The migrated local storage is incomplete and cannot be used safely.'
            : bootstrapError.message}
        </Text>
        {recoveryAction}
      </View>
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
